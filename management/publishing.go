package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PublishingService handles model publishing operations
type PublishingService struct {
	k8sClient   *K8sClient
	authService *AuthService
	config      *Config
}

// NewPublishingService creates a new publishing service
func NewPublishingService(k8sClient *K8sClient, authService *AuthService) *PublishingService {
	return &PublishingService{
		k8sClient:   k8sClient,
		authService: authService,
		config:      NewConfig(),
	}
}

// Publishing error codes
const (
	ErrModelNotFound        = "MODEL_NOT_FOUND"
	ErrModelNotReady        = "MODEL_NOT_READY"
	ErrInvalidTenant        = "INVALID_TENANT"
	ErrAlreadyPublished     = "ALREADY_PUBLISHED"
	ErrGatewayConfigFailed  = "GATEWAY_CONFIG_FAILED"
	ErrRateLimitConfigFailed = "RATE_LIMIT_CONFIG_FAILED"
	ErrAPIKeyGenerationFailed = "API_KEY_GENERATION_FAILED"
)

// PublishModel handles POST /api/models/:modelName/publish
func (s *PublishingService) PublishModel(c *gin.Context) {
	modelName := c.Param("modelName")
	
	// Get user from JWT context
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Authentication required",
		})
		return
	}

	u, ok := user.(*User)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Invalid user context",
		})
		return
	}

	// Parse request body
	var req PublishModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	// Determine namespace
	namespace := u.Tenant
	if u.IsAdmin && req.Config.TenantID != "" {
		namespace = req.Config.TenantID
	}

	// Validate user permissions
	if !u.IsAdmin && u.Tenant != namespace {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Error: "Insufficient permissions for tenant: " + namespace,
		})
		return
	}

	// Create error reporter and rollback handler
	errorReporter := NewErrorReporter(s)
	rollback := NewPublishingRollback(s, namespace, modelName)
	
	// Validate publishing request
	validator := NewPublishingValidator(s)
	if validationErrors := validator.ValidatePublishRequest(namespace, modelName, req.Config); len(validationErrors) > 0 {
		var errorMessages []string
		for _, err := range validationErrors {
			errorMessages = append(errorMessages, err.Error())
		}
		
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Validation failed",
			Details: strings.Join(errorMessages, "; "),
		})
		return
	}

	// Check if model is already published
	if s.isModelPublished(namespace, modelName) {
		c.JSON(http.StatusConflict, ErrorResponse{
			Error: "Model is already published",
		})
		return
	}

	// Detect model type if not specified
	modelType := req.Config.ModelType
	if modelType == "" {
		detectedType, err := s.detectModelType(namespace, modelName)
		if err != nil {
			publishingErr := NewPublishingError(ErrModelNotFound, "Failed to detect model type", namespace, modelName, "model_detection", err)
			errorReporter.ReportError(u, namespace, modelName, "detect_model_type", publishingErr)
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   publishingErr.Message,
				Details: publishingErr.Details,
			})
			return
		}
		modelType = detectedType
	}

	// Apply defaults if not provided
	if req.Config.PublicHostname == "" {
		req.Config.PublicHostname = "api.router.inference-in-a-box"
	}

	// Step 1: Generate API key
	_, apiKey, err := s.generateAPIKey(u, modelName, namespace, modelType)
	if err != nil {
		publishingErr := NewPublishingError(ErrAPIKeyGenerationFailed, "Failed to generate API key", namespace, modelName, "api_key_generation", err)
		errorReporter.ReportError(u, namespace, modelName, "generate_api_key", publishingErr)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   publishingErr.Message,
			Details: publishingErr.Details,
		})
		return
	}
	rollback.AddStep("api_key")

	// Step 2: Create gateway configuration
	externalURL, err := s.createGatewayConfiguration(namespace, modelName, modelType, req.Config)
	if err != nil {
		publishingErr := NewPublishingError(ErrGatewayConfigFailed, "Failed to create gateway configuration", namespace, modelName, "gateway_config", err)
		errorReporter.ReportError(u, namespace, modelName, "create_gateway_config", publishingErr)
		rollback.Execute()
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   publishingErr.Message,
			Details: publishingErr.Details,
		})
		return
	}
	rollback.AddStep("gateway_config")

	// Step 3: Create rate limiting policy
	if err := s.createRateLimitingPolicy(namespace, modelName, req.Config.RateLimiting); err != nil {
		publishingErr := NewPublishingError(ErrRateLimitConfigFailed, "Failed to create rate limiting policy", namespace, modelName, "rate_limiting", err)
		errorReporter.ReportError(u, namespace, modelName, "create_rate_limiting", publishingErr)
		rollback.Execute()
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   publishingErr.Message,
			Details: publishingErr.Details,
		})
		return
	}
	rollback.AddStep("rate_limiting")

	// Step 4: Generate documentation
	documentation := s.generateAPIDocumentation(namespace, modelName, modelType, externalURL, apiKey)

	// Step 5: Create published model response
	publishedModel := PublishedModel{
		ModelName:      modelName,
		Namespace:      namespace,
		TenantID:       namespace,
		ModelType:      modelType,
		ExternalURL:    externalURL,
		PublicHostname: req.Config.PublicHostname,
		APIKey:         apiKey,
		RateLimiting:   req.Config.RateLimiting,
		Status:         "active",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Usage:          UsageStats{},
		Documentation:  documentation,
	}

	// Step 6: Store published model metadata
	if err := s.storePublishedModelMetadata(namespace, modelName, publishedModel); err != nil {
		publishingErr := NewPublishingError("METADATA_STORAGE_FAILED", "Failed to store published model metadata", namespace, modelName, "metadata_storage", err)
		errorReporter.ReportError(u, namespace, modelName, "store_metadata", publishingErr)
		rollback.Execute()
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   publishingErr.Message,
			Details: publishingErr.Details,
		})
		return
	}
	rollback.AddStep("metadata")

	// Log the publishing event
	s.logPublishingEvent(u, modelName, namespace, "published")

	c.JSON(http.StatusOK, PublishModelResponse{
		Message:       "Model published successfully",
		PublishedModel: publishedModel,
	})
}

// UpdatePublishedModel handles PUT /api/models/:modelName/publish
func (s *PublishingService) UpdatePublishedModel(c *gin.Context) {
	modelName := c.Param("modelName")
	
	// Get user from JWT context
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Authentication required",
		})
		return
	}

	u, ok := user.(*User)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Invalid user context",
		})
		return
	}

	// Parse request body
	var req PublishModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	// Determine namespace
	namespace := u.Tenant
	if u.IsAdmin && req.Config.TenantID != "" {
		namespace = req.Config.TenantID
	}

	// Validate user permissions
	if !u.IsAdmin && u.Tenant != namespace {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Error: "Insufficient permissions for tenant: " + namespace,
		})
		return
	}

	// Check if model is published
	if !s.isModelPublished(namespace, modelName) {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error: "Model is not published",
		})
		return
	}

	// Get current published model metadata
	currentModel, err := s.getPublishedModelMetadata(namespace, modelName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get current published model",
			Details: err.Error(),
		})
		return
	}

	// Create error reporter and rollback handler
	errorReporter := NewErrorReporter(s)
	rollback := NewPublishingRollback(s, namespace, modelName)

	// Validate the update request
	validator := NewPublishingValidator(s)
	if validationErrors := validator.ValidateUpdateRequest(namespace, modelName, req.Config, currentModel); len(validationErrors) > 0 {
		var errorMessages []string
		for _, err := range validationErrors {
			errorMessages = append(errorMessages, err.Error())
		}
		
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Validation failed",
			Details: strings.Join(errorMessages, "; "),
		})
		return
	}

	// Apply defaults if not provided
	if req.Config.PublicHostname == "" {
		req.Config.PublicHostname = "api.router.inference-in-a-box"
	}

	// Update gateway configuration if hostname or path changed
	if req.Config.PublicHostname != currentModel.PublicHostname || req.Config.ExternalPath != "" {
		// First cleanup old gateway config
		s.cleanupGatewayConfiguration(namespace, modelName)
		rollback.AddStep("cleanup_old_gateway")

		// Create new gateway configuration
		externalURL, err := s.createGatewayConfiguration(namespace, modelName, currentModel.ModelType, req.Config)
		if err != nil {
			publishingErr := NewPublishingError(ErrGatewayConfigFailed, "Failed to update gateway configuration", namespace, modelName, "gateway_config_update", err)
			errorReporter.ReportError(u, namespace, modelName, "update_gateway_config", publishingErr)
			rollback.Execute()
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   publishingErr.Message,
				Details: publishingErr.Details,
			})
			return
		}
		currentModel.ExternalURL = externalURL
		currentModel.PublicHostname = req.Config.PublicHostname
		rollback.AddStep("gateway_config")
	}

	// Update rate limiting policy if changed
	if req.Config.RateLimiting.RequestsPerMinute != currentModel.RateLimiting.RequestsPerMinute ||
		req.Config.RateLimiting.RequestsPerHour != currentModel.RateLimiting.RequestsPerHour ||
		req.Config.RateLimiting.TokensPerHour != currentModel.RateLimiting.TokensPerHour ||
		req.Config.RateLimiting.BurstLimit != currentModel.RateLimiting.BurstLimit {
		
		// Cleanup old rate limiting policy
		s.cleanupRateLimitingPolicy(namespace, modelName)
		
		// Create new rate limiting policy
		if err := s.createRateLimitingPolicy(namespace, modelName, req.Config.RateLimiting); err != nil {
			publishingErr := NewPublishingError(ErrRateLimitConfigFailed, "Failed to update rate limiting policy", namespace, modelName, "rate_limiting_update", err)
			errorReporter.ReportError(u, namespace, modelName, "update_rate_limiting", publishingErr)
			rollback.Execute()
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   publishingErr.Message,
				Details: publishingErr.Details,
			})
			return
		}
		currentModel.RateLimiting = req.Config.RateLimiting
		rollback.AddStep("rate_limiting")
	}

	// Update metadata
	currentModel.UpdatedAt = time.Now()
	if req.Config.Metadata != nil {
		// Update metadata - this is stored in the published model record
		// For now, we'll just note that metadata was updated
		currentModel.UpdatedAt = time.Now()
	}

	// Regenerate documentation with updated URL
	currentModel.Documentation = s.generateAPIDocumentation(namespace, modelName, currentModel.ModelType, currentModel.ExternalURL, currentModel.APIKey)

	// Store updated metadata
	if err := s.storePublishedModelMetadata(namespace, modelName, *currentModel); err != nil {
		publishingErr := NewPublishingError("METADATA_UPDATE_FAILED", "Failed to update published model metadata", namespace, modelName, "metadata_update", err)
		errorReporter.ReportError(u, namespace, modelName, "update_metadata", publishingErr)
		rollback.Execute()
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   publishingErr.Message,
			Details: publishingErr.Details,
		})
		return
	}

	// Log the update event
	s.logPublishingEvent(u, modelName, namespace, "updated")

	c.JSON(http.StatusOK, PublishModelResponse{
		Message:        "Published model updated successfully",
		PublishedModel: *currentModel,
	})
}

// UnpublishModel handles DELETE /api/models/:modelName/publish
func (s *PublishingService) UnpublishModel(c *gin.Context) {
	modelName := c.Param("modelName")
	
	// Get user from JWT context
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Authentication required",
		})
		return
	}

	u, ok := user.(*User)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Invalid user context",
		})
		return
	}

	namespace := u.Tenant
	if u.IsAdmin {
		// Admin can unpublish from any namespace
		if ns := c.Query("namespace"); ns != "" {
			namespace = ns
		} else {
			// If no namespace specified, find where the model is published
			foundNamespace := s.findModelPublishedNamespace(modelName)
			if foundNamespace != "" {
				namespace = foundNamespace
			}
		}
	}

	// Validate user permissions
	if !u.IsAdmin && u.Tenant != namespace {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Error: "Insufficient permissions for tenant: " + namespace,
		})
		return
	}

	// Check if model is published
	if !s.isModelPublished(namespace, modelName) {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error: "Model is not published",
		})
		return
	}

	// Clean up all resources
	s.cleanupAPIKey(namespace, modelName)
	s.cleanupGatewayConfiguration(namespace, modelName)
	s.cleanupRateLimitingPolicy(namespace, modelName)
	s.cleanupPublishedModelMetadata(namespace, modelName)

	// Log the unpublishing event
	s.logPublishingEvent(u, modelName, namespace, "unpublished")

	c.JSON(http.StatusOK, gin.H{
		"message": "Model unpublished successfully",
	})
}

// GetPublishedModel handles GET /api/models/:modelName/publish
func (s *PublishingService) GetPublishedModel(c *gin.Context) {
	modelName := c.Param("modelName")
	
	// Get user from JWT context
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Authentication required",
		})
		return
	}

	u, ok := user.(*User)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Invalid user context",
		})
		return
	}

	namespace := u.Tenant
	if u.IsAdmin {
		if ns := c.Query("namespace"); ns != "" {
			namespace = ns
		}
	}

	// Validate user permissions
	if !u.IsAdmin && u.Tenant != namespace {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Error: "Insufficient permissions for tenant: " + namespace,
		})
		return
	}

	// Get published model metadata
	publishedModel, err := s.getPublishedModelMetadata(namespace, modelName)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Published model not found",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, publishedModel)
}

// ListPublishedModels handles GET /api/published-models
func (s *PublishingService) ListPublishedModels(c *gin.Context) {
	// Get user from JWT context
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Authentication required",
		})
		return
	}

	u, ok := user.(*User)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Invalid user context",
		})
		return
	}

	var publishedModels []PublishedModel
	var err error

	if u.IsAdmin {
		// Admin can see all published models
		publishedModels, err = s.listAllPublishedModels()
	} else {
		// Regular users see only their tenant's published models
		publishedModels, err = s.listPublishedModelsByTenant(u.Tenant)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to list published models",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, ListPublishedModelsResponse{
		PublishedModels: publishedModels,
		Total:           len(publishedModels),
	})
}

// RotateAPIKey handles POST /api/models/:modelName/publish/rotate-key
func (s *PublishingService) RotateAPIKey(c *gin.Context) {
	modelName := c.Param("modelName")
	
	// Get user from JWT context
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Authentication required",
		})
		return
	}

	u, ok := user.(*User)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Invalid user context",
		})
		return
	}

	namespace := u.Tenant
	if u.IsAdmin {
		if ns := c.Query("namespace"); ns != "" {
			namespace = ns
		}
	}

	// Validate user permissions
	if !u.IsAdmin && u.Tenant != namespace {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Error: "Insufficient permissions for tenant: " + namespace,
		})
		return
	}

	// Check if model is published
	if !s.isModelPublished(namespace, modelName) {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error: "Model is not published",
		})
		return
	}

	// Get current published model metadata
	publishedModel, err := s.getPublishedModelMetadata(namespace, modelName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get published model metadata",
			Details: err.Error(),
		})
		return
	}

	// Generate new API key
	_, newAPIKey, err := s.generateAPIKey(u, modelName, namespace, publishedModel.ModelType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to generate new API key",
			Details: err.Error(),
		})
		return
	}

	// Update published model metadata
	publishedModel.APIKey = newAPIKey
	publishedModel.UpdatedAt = time.Now()

	if err := s.storePublishedModelMetadata(namespace, modelName, *publishedModel); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to update published model metadata",
			Details: err.Error(),
		})
		return
	}

	// Log the key rotation event
	s.logPublishingEvent(u, modelName, namespace, "api_key_rotated")

	c.JSON(http.StatusOK, RotateAPIKeyResponse{
		Message:   "API key rotated successfully",
		NewAPIKey: newAPIKey,
		UpdatedAt: time.Now(),
	})
}

// ValidateAPIKey handles POST /api/validate-api-key (for gateway)
func (s *PublishingService) ValidateAPIKey(c *gin.Context) {
	apiKey := c.GetHeader("X-API-Key")
	if apiKey == "" {
		apiKey = c.GetHeader("Authorization")
		if strings.HasPrefix(apiKey, "Bearer ") {
			apiKey = strings.TrimPrefix(apiKey, "Bearer ")
		}
	}

	if apiKey == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "API key required",
		})
		return
	}

	// Validate API key
	metadata, err := s.validateAPIKey(apiKey)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid API key",
		})
		return
	}

	// Update last used time
	s.updateAPIKeyLastUsed(metadata.Namespace, metadata.ModelName)

	// Set headers for upstream
	c.Header("X-Tenant-ID", metadata.TenantID)
	c.Header("X-Model-Name", metadata.ModelName)
	c.Header("X-Model-Type", metadata.ModelType)
	
	c.JSON(http.StatusOK, gin.H{
		"valid": true,
		"tenant": metadata.TenantID,
		"model": metadata.ModelName,
	})
}

// Helper methods - Core publishing service logic
func (s *PublishingService) validateModelExists(namespace, modelName string) error {
	// Check if InferenceService exists and is ready
	inferenceService, err := s.k8sClient.GetInferenceService(namespace, modelName)
	if err != nil {
		return fmt.Errorf("model %s not found in namespace %s: %w", modelName, namespace, err)
	}
	
	// Check if the model is ready
	status, ok := inferenceService["status"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("model %s status not available", modelName)
	}
	
	conditions, ok := status["conditions"].([]interface{})
	if !ok {
		return fmt.Errorf("model %s conditions not available", modelName)
	}
	
	// Check for Ready condition
	for _, condition := range conditions {
		if cond, ok := condition.(map[string]interface{}); ok {
			if cond["type"] == "Ready" && cond["status"] == "True" {
				return nil
			}
		}
	}
	
	return fmt.Errorf("model %s is not ready", modelName)
}

func (s *PublishingService) isModelPublished(namespace, modelName string) bool {
	// Check if published model metadata exists
	_, err := s.k8sClient.GetPublishedModelMetadata(namespace, modelName)
	return err == nil
}

func (s *PublishingService) findModelPublishedNamespace(modelName string) string {
	// Search across all tenant namespaces to find where the model is published
	namespaces, err := s.k8sClient.GetTenantNamespaces()
	if err != nil {
		log.Printf("Failed to get tenant namespaces: %v", err)
		// Fallback to hardcoded list
		namespaces = []string{"tenant-a", "tenant-b", "tenant-c"}
	}
	
	for _, namespace := range namespaces {
		if s.isModelPublished(namespace, modelName) {
			return namespace
		}
	}
	
	return ""
}

func (s *PublishingService) detectModelType(namespace, modelName string) (string, error) {
	// Get the InferenceService to analyze its configuration
	inferenceService, err := s.k8sClient.GetInferenceService(namespace, modelName)
	if err != nil {
		return "", fmt.Errorf("failed to get inference service: %w", err)
	}
	
	// Check spec for model type indicators
	spec, ok := inferenceService["spec"].(map[string]interface{})
	if !ok {
		return "traditional", nil
	}
	
	// Check for OpenAI-compatible annotations or labels first (explicit configuration)
	metadata, ok := inferenceService["metadata"].(map[string]interface{})
	if ok {
		if annotations, ok := metadata["annotations"].(map[string]interface{}); ok {
			if modelType, exists := annotations["serving.kserve.io/api-type"]; exists {
				if strings.ToLower(fmt.Sprintf("%v", modelType)) == "openai" {
					return "openai", nil
				}
			}
			if modelType, exists := annotations["model.type"]; exists {
				if strings.ToLower(fmt.Sprintf("%v", modelType)) == "openai" {
					return "openai", nil
				}
			}
		}
	}
	
	// Check predictor configuration for OpenAI compatibility indicators
	if predictor, ok := spec["predictor"].(map[string]interface{}); ok {
		// 1. Check for custom containers with OpenAI-compatible images
		if containers, ok := predictor["containers"].([]interface{}); ok {
			for _, container := range containers {
				if c, ok := container.(map[string]interface{}); ok {
					if image, ok := c["image"].(string); ok {
						imageLower := strings.ToLower(image)
						// Check for common OpenAI-compatible images
						openaiImages := []string{
							"vllm/vllm-openai",
							"ghcr.io/huggingface/text-generation-inference",
							"openai/triton-inference-server",
							"nvidia/tritonserver",
							"text-generation-inference",
							"vllm",
						}
						for _, openaiImage := range openaiImages {
							if strings.Contains(imageLower, openaiImage) {
								return "openai", nil
							}
						}
						
						// Check for LLM model names in image
						llmIndicators := []string{
							"llama", "mistral", "falcon", "vicuna", "alpaca",
							"gpt", "bert", "t5", "bloom", "opt",
						}
						for _, indicator := range llmIndicators {
							if strings.Contains(imageLower, indicator) {
								return "openai", nil
							}
						}
					}
				}
			}
		}
		
		// 2. Check for HuggingFace models with text generation capability
		if huggingface, ok := predictor["huggingface"].(map[string]interface{}); ok {
			if task, ok := huggingface["task"].(string); ok {
				openaiTasks := []string{
					"text-generation",
					"text2text-generation", 
					"conversational",
					"feature-extraction",
				}
				taskLower := strings.ToLower(task)
				for _, openaiTask := range openaiTasks {
					if strings.Contains(taskLower, openaiTask) {
						return "openai", nil
					}
				}
			}
			
			// Check model URI for transformer indicators
			if modelUri, ok := huggingface["modelUri"].(string); ok {
				modelUriLower := strings.ToLower(modelUri)
				transformerIndicators := []string{
					"transformer", "llama", "mistral", "falcon", "vicuna",
					"gpt", "bert", "t5", "bloom", "opt", "alpaca",
				}
				for _, indicator := range transformerIndicators {
					if strings.Contains(modelUriLower, indicator) {
						return "openai", nil
					}
				}
			}
		}
		
		// 3. Check for PyTorch models with transformer architecture
		if pytorch, ok := predictor["pytorch"].(map[string]interface{}); ok {
			if modelUri, ok := pytorch["modelUri"].(string); ok {
				modelUriLower := strings.ToLower(modelUri)
				transformerIndicators := []string{
					"transformer", "llama", "mistral", "falcon", "vicuna",
					"gpt", "bert", "t5", "bloom", "opt", "alpaca",
				}
				for _, indicator := range transformerIndicators {
					if strings.Contains(modelUriLower, indicator) {
						return "openai", nil
					}
				}
			}
		}
	}
	
	// Default to traditional inference
	return "traditional", nil
}

func (s *PublishingService) generateAPIKey(user *User, modelName, namespace, modelType string) (*APIKeyMetadata, string, error) {
	// Generate cryptographically secure API key
	keyBytes := make([]byte, 32)
	if _, err := rand.Read(keyBytes); err != nil {
		return nil, "", err
	}
	
	apiKey := base64.URLEncoding.EncodeToString(keyBytes)
	
	// Create metadata
	metadata := &APIKeyMetadata{
		KeyID:       generateKeyID(),
		ModelName:   modelName,
		Namespace:   namespace,
		TenantID:    user.Tenant,
		ModelType:   modelType,
		CreatedAt:   time.Now(),
		IsActive:    true,
		Permissions: []string{"inference"},
	}
	
	// Store API key
	if err := s.storeAPIKey(namespace, modelName, apiKey, metadata); err != nil {
		return nil, "", err
	}
	
	return metadata, apiKey, nil
}

func (s *PublishingService) createGatewayConfiguration(namespace, modelName, modelType string, config PublishConfig) (string, error) {
	// Generate route name
	routeName := fmt.Sprintf("published-model-%s-%s", namespace, modelName)
	
	// Create the appropriate gateway configuration based on model type
	if modelType == "openai" {
		return s.createAIGatewayRoute(namespace, modelName, routeName, config)
	} else {
		return s.createHTTPRoute(namespace, modelName, routeName, config)
	}
}

func (s *PublishingService) createHTTPRoute(namespace, modelName, routeName string, config PublishConfig) (string, error) {
	// Generate external path
	externalPath := config.ExternalPath
	if externalPath == "" {
		externalPath = fmt.Sprintf("/published/models/%s", modelName)
	}
	
	// Determine hostname
	hostname := config.PublicHostname
	if hostname == "" {
		hostname = "api.router.inference-in-a-box"
	}
	
	// Get KServe hostname from InferenceService
	kserveHostname, err := s.generateKServeHostname(modelName, namespace)
	if err != nil {
		return "", fmt.Errorf("failed to generate KServe hostname: %w", err)
	}
	
	// Create HTTPRoute configuration
	httpRoute := map[string]interface{}{
		"apiVersion": "gateway.networking.k8s.io/v1",
		"kind":       "HTTPRoute",
		"metadata": map[string]interface{}{
			"name":      routeName,
			"namespace": "envoy-gateway-system",
			"labels": map[string]interface{}{
				"app":        "published-model",
				"model-name": modelName,
				"tenant":     namespace,
				"hostname":   hostname,
			},
		},
		"spec": map[string]interface{}{
			"hostnames": []interface{}{hostname}, // Add hostname specification
			"parentRefs": []interface{}{
				map[string]interface{}{
					"name":      "ai-inference-gateway",
					"namespace": "envoy-gateway-system",
				},
			},
			"rules": []interface{}{
				map[string]interface{}{
					"matches": []interface{}{
						map[string]interface{}{
							"path": map[string]interface{}{
								"type":  "PathPrefix",
								"value": externalPath,
							},
							"headers": []interface{}{
								map[string]interface{}{
									"name": "x-api-key",
									"type":  "RegularExpression",
									"value": ".*",
								},
							},
						},
					},
					"filters": []interface{}{
						map[string]interface{}{
							"type": "URLRewrite",
							"urlRewrite": map[string]interface{}{
								"hostname": kserveHostname,
								"path": map[string]interface{}{
									"type":            "ReplaceFullPath",
									"replaceFullPath": s.generateKServeModelPath(modelName),
								},
							},
						},
						map[string]interface{}{
							"type": "RequestHeaderModifier",
							"requestHeaderModifier": map[string]interface{}{
								"set": []interface{}{
									map[string]interface{}{
										"name":  "x-tenant",
										"value": namespace,
									},
									map[string]interface{}{
										"name":  "x-model-name",
										"value": modelName,
									},
									map[string]interface{}{
										"name":  "x-gateway",
										"value": "published-model",
									},
									map[string]interface{}{
										"name":  "x-hostname",
										"value": hostname,
									},
								},
							},
						},
					},
					"backendRefs": []interface{}{
						map[string]interface{}{
							"name":      "istio-ingressgateway",
							"namespace": "istio-system",
							"port":      80,
						},
					},
				},
			},
		},
	}
	
	// Update Gateway to include this hostname
	if err := s.updateGatewayForHostname(hostname); err != nil {
		return "", fmt.Errorf("failed to update gateway for hostname %s: %w", hostname, err)
	}
	
	// Create the HTTPRoute
	if err := s.k8sClient.CreateHTTPRoute("envoy-gateway-system", httpRoute); err != nil {
		return "", fmt.Errorf("failed to create HTTPRoute: %w", err)
	}
	
	// Return the external URL using the configured hostname
	return fmt.Sprintf("https://%s%s", hostname, externalPath), nil
}

// generateKServeHostname generates the KServe predictor hostname for a model by looking up the InferenceService
func (s *PublishingService) generateKServeHostname(modelName, namespace string) (string, error) {
	// Get the InferenceService to extract the URL
	inferenceService, err := s.k8sClient.GetInferenceService(namespace, modelName)
	if err != nil {
		return "", fmt.Errorf("failed to get InferenceService: %w", err)
	}
	
	// Extract URL from status
	if status, ok := inferenceService["status"].(map[string]interface{}); ok {
		if url, ok := status["url"].(string); ok {
			// Parse the URL to extract hostname
			// Format: http://model-name.namespace.127.0.0.1.sslip.io
			// We need to remove the protocol and return just the hostname
			if len(url) > 7 && url[:7] == "http://" {
				return url[7:], nil
			}
			if len(url) > 8 && url[:8] == "https://" {
				return url[8:], nil
			}
			return url, nil
		}
	}
	
	// Fallback to constructed hostname if status URL is not available
	return fmt.Sprintf("%s-predictor.%s.127.0.0.1.sslip.io", modelName, namespace), nil
}

// generateKServeModelPath generates the KServe model endpoint path for a model
func (s *PublishingService) generateKServeModelPath(modelName string) string {
	return fmt.Sprintf("/v1/models/%s:predict", modelName)
}

func (s *PublishingService) createAIGatewayRoute(namespace, modelName, routeName string, config PublishConfig) (string, error) {
	// Generate external path for OpenAI compatibility
	externalPath := config.ExternalPath
	if externalPath == "" {
		externalPath = fmt.Sprintf("/v1/models/%s", modelName)
	}

	// Determine hostname
	hostname := config.PublicHostname
	if hostname == "" {
		hostname = "api.router.inference-in-a-box"
	}

	// Get KServe hostname from InferenceService (same as HTTPRoute)
	kserveHostname, err := s.generateKServeHostname(modelName, namespace)
	if err != nil {
		return "", fmt.Errorf("failed to generate KServe hostname: %w", err)
	}

	// Create Backend resource for host header rewriting using fqdn
	backendName := fmt.Sprintf("%s-backend", modelName)
	if err := s.createBackend(namespace, modelName, backendName, kserveHostname); err != nil {
		return "", fmt.Errorf("failed to create Backend: %w", err)
	}

	// Create AIServiceBackend resource that references the Backend
	if err := s.createAIServiceBackend(namespace, modelName, backendName, kserveHostname); err != nil {
		return "", fmt.Errorf("failed to create AIServiceBackend: %w", err)
	}

	// Create ReferenceGrant for cross-namespace access
	if err := s.createReferenceGrant(namespace, modelName); err != nil {
		return "", fmt.Errorf("failed to create ReferenceGrant: %w", err)
	}


	// Update Gateway to include this hostname
	if err := s.updateGatewayForHostname(hostname); err != nil {
		return "", fmt.Errorf("failed to update gateway for hostname %s: %w", hostname, err)
	}
	
	// Create AIGatewayRoute configuration
	aiGatewayRoute := map[string]interface{}{
		"apiVersion": "aigateway.envoyproxy.io/v1alpha1",
		"kind":       "AIGatewayRoute",
		"metadata": map[string]interface{}{
			"name":      routeName,
			"namespace": "envoy-gateway-system",
			"labels": map[string]interface{}{
				"app":        "published-model",
				"model-name": modelName,
				"tenant":     namespace,
				"type":       "openai",
				"hostname":   hostname,
			},
		},
		"spec": map[string]interface{}{
			"schema": map[string]interface{}{
				"name": "OpenAI",
			},
			"targetRefs": []interface{}{
				map[string]interface{}{
					"name":      "ai-inference-gateway",
					"namespace": "envoy-gateway-system",
					"kind":      "Gateway",
					"group":     "gateway.networking.k8s.io",
				},
			},
			"hostnames": []interface{}{hostname},
			"rules": []interface{}{
				map[string]interface{}{
					"matches": []interface{}{
						map[string]interface{}{
							"headers": []interface{}{
								map[string]interface{}{
									"type":  "Exact",
									"name":  "x-ai-eg-model",
									"value": modelName,
								},
								// Removed x-api-key header match - AIGateway handles auth differently
								// Authentication is handled at the gateway level
							},
						},
					},
					// AIGatewayRoute relies on the AI Gateway to handle OpenAI protocol transformation
					// The AIServiceBackend references a Backend resource with fqdn for host header rewriting
					// Backend fqdn automatically handles host header rewriting to KServe hostname
					"backendRefs": []interface{}{
						map[string]interface{}{
							"name":   backendName + "-ai",
							"weight": 100,
						},
					},
				},
			},
			"llmRequestCosts": []interface{}{
				map[string]interface{}{
					"metadataKey": "llm_input_token",
					"type":        "InputToken",
				},
				map[string]interface{}{
					"metadataKey": "llm_output_token",
					"type":        "OutputToken",
				},
				map[string]interface{}{
					"metadataKey": "llm_total_token",
					"type":        "TotalToken",
				},
			},
		},
	}
	
	// Create the AIGatewayRoute
	if err := s.k8sClient.CreateAIGatewayRoute("envoy-gateway-system", aiGatewayRoute); err != nil {
		return "", fmt.Errorf("failed to create AIGatewayRoute: %w", err)
	}
	
	// Return the external URL using the configured hostname
	return fmt.Sprintf("https://%s%s", hostname, externalPath), nil
}

func (s *PublishingService) createRateLimitingPolicy(namespace, modelName string, rateLimiting RateLimitConfig) error {
	// Generate policy name
	policyName := fmt.Sprintf("published-model-rate-limit-%s-%s", namespace, modelName)
	
	// Create BackendTrafficPolicy for rate limiting
	policy := map[string]interface{}{
		"apiVersion": "gateway.envoyproxy.io/v1alpha1",
		"kind":       "BackendTrafficPolicy",
		"metadata": map[string]interface{}{
			"name":      policyName,
			"namespace": "envoy-gateway-system",
			"labels": map[string]interface{}{
				"app":        "published-model",
				"model-name": modelName,
				"tenant":     namespace,
			},
		},
		"spec": map[string]interface{}{
			"targetRefs": []interface{}{
				map[string]interface{}{
					"group":     "gateway.networking.k8s.io",
					"kind":      "HTTPRoute",
					"name":      fmt.Sprintf("published-model-%s-%s", namespace, modelName),
					"namespace": "envoy-gateway-system",
				},
			},
			"rateLimit": map[string]interface{}{
				"type": "Global",
				"global": map[string]interface{}{
					"rules": []interface{}{
						map[string]interface{}{
							"clientSelectors": []interface{}{
								map[string]interface{}{
									"headers": []interface{}{
										map[string]interface{}{
											"name":  "x-api-key",
											"type":  "RegularExpression",
											"value": ".*",
										},
									},
								},
							},
							"limit": map[string]interface{}{
								"requests": rateLimiting.RequestsPerMinute,
								"unit":     "Minute",
							},
						},
					},
				},
			},
		},
	}
	
	// Add token bucket configuration for OpenAI models
	if rateLimiting.TokensPerHour > 0 {
		rules := policy["spec"].(map[string]interface{})["rateLimit"].(map[string]interface{})["global"].(map[string]interface{})["rules"].([]interface{})
		
		// Add token-based rate limiting
		tokenRule := map[string]interface{}{
			"clientSelectors": []interface{}{
				map[string]interface{}{
					"headers": []interface{}{
						map[string]interface{}{
							"name":  "x-model-type",
							"value": "openai",
						},
					},
				},
			},
			"limit": map[string]interface{}{
				"requests": rateLimiting.TokensPerHour,
				"unit":     "Hour",
			},
		}
		
		rules = append(rules, tokenRule)
		policy["spec"].(map[string]interface{})["rateLimit"].(map[string]interface{})["global"].(map[string]interface{})["rules"] = rules
	}
	
	// Create the BackendTrafficPolicy
	if err := s.k8sClient.CreateBackendTrafficPolicy("envoy-gateway-system", policy); err != nil {
		return fmt.Errorf("failed to create rate limiting policy: %w", err)
	}
	
	return nil
}

func (s *PublishingService) generateAPIDocumentation(namespace, modelName, modelType, externalURL, apiKey string) APIDocumentation {
	docGenerator := NewDocumentationGenerator(s.config)
	return docGenerator.GenerateAPIDocumentation(namespace, modelName, modelType, externalURL, apiKey)
}

func (s *PublishingService) storePublishedModelMetadata(namespace, modelName string, model PublishedModel) error {
	// Convert PublishedModel to map for storage
	modelMap := map[string]interface{}{
		"modelName":      model.ModelName,
		"namespace":      model.Namespace,
		"tenantId":       model.TenantID,
		"modelType":      model.ModelType,
		"externalUrl":    model.ExternalURL,
		"publicHostname": model.PublicHostname,
		"apiKey":         model.APIKey,
		"rateLimiting":   model.RateLimiting,
		"status":         model.Status,
		"createdAt":      model.CreatedAt,
		"updatedAt":      model.UpdatedAt,
		"usage":          model.Usage,
		"documentation":  model.Documentation,
	}
	
	// Store the metadata using K8s client
	return s.k8sClient.CreatePublishedModelMetadata(namespace, modelName, modelMap)
}

func (s *PublishingService) getPublishedModelMetadata(namespace, modelName string) (*PublishedModel, error) {
	// Get metadata from K8s
	metadata, err := s.k8sClient.GetPublishedModelMetadata(namespace, modelName)
	if err != nil {
		return nil, err
	}
	
	// Convert metadata map to PublishedModel struct
	model := &PublishedModel{}
	
	if v, ok := metadata["modelName"].(string); ok {
		model.ModelName = v
	}
	if v, ok := metadata["namespace"].(string); ok {
		model.Namespace = v
	}
	if v, ok := metadata["tenantId"].(string); ok {
		model.TenantID = v
	}
	if v, ok := metadata["modelType"].(string); ok {
		model.ModelType = v
	}
	if v, ok := metadata["externalUrl"].(string); ok {
		model.ExternalURL = v
	}
	if v, ok := metadata["publicHostname"].(string); ok {
		model.PublicHostname = v
	}
	if v, ok := metadata["apiKey"].(string); ok {
		model.APIKey = v
	}
	if v, ok := metadata["status"].(string); ok {
		model.Status = v
	}
	
	// Handle time fields
	if v, ok := metadata["createdAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			model.CreatedAt = t
		}
	}
	if v, ok := metadata["updatedAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			model.UpdatedAt = t
		}
	}
	
	// Handle nested structures (simplified for now)
	if v, ok := metadata["rateLimiting"].(map[string]interface{}); ok {
		if rpm, ok := v["requestsPerMinute"].(float64); ok {
			model.RateLimiting.RequestsPerMinute = int(rpm)
		}
		if rph, ok := v["requestsPerHour"].(float64); ok {
			model.RateLimiting.RequestsPerHour = int(rph)
		}
		if tph, ok := v["tokensPerHour"].(float64); ok {
			model.RateLimiting.TokensPerHour = int(tph)
		}
		if bl, ok := v["burstLimit"].(float64); ok {
			model.RateLimiting.BurstLimit = int(bl)
		}
	}
	
	return model, nil
}

func (s *PublishingService) listAllPublishedModels() ([]PublishedModel, error) {
	// Get all published models across all namespaces
	metadataList, err := s.k8sClient.ListPublishedModels("")
	if err != nil {
		return nil, err
	}
	
	var models []PublishedModel
	for _, metadata := range metadataList {
		if model, err := s.convertMetadataToModel(metadata); err == nil {
			models = append(models, *model)
		}
	}
	
	return models, nil
}

func (s *PublishingService) listPublishedModelsByTenant(tenantID string) ([]PublishedModel, error) {
	// Get published models for specific tenant
	metadataList, err := s.k8sClient.ListPublishedModels(tenantID)
	if err != nil {
		return nil, err
	}
	
	var models []PublishedModel
	for _, metadata := range metadataList {
		if model, err := s.convertMetadataToModel(metadata); err == nil {
			models = append(models, *model)
		}
	}
	
	return models, nil
}

func (s *PublishingService) convertMetadataToModel(metadata map[string]interface{}) (*PublishedModel, error) {
	model := &PublishedModel{}
	
	if v, ok := metadata["modelName"].(string); ok {
		model.ModelName = v
	}
	if v, ok := metadata["namespace"].(string); ok {
		model.Namespace = v
	}
	if v, ok := metadata["tenantId"].(string); ok {
		model.TenantID = v
	}
	if v, ok := metadata["modelType"].(string); ok {
		model.ModelType = v
	}
	if v, ok := metadata["externalUrl"].(string); ok {
		model.ExternalURL = v
	}
	if v, ok := metadata["publicHostname"].(string); ok {
		model.PublicHostname = v
	}
	if v, ok := metadata["apiKey"].(string); ok {
		model.APIKey = v
	}
	if v, ok := metadata["status"].(string); ok {
		model.Status = v
	}
	
	// Handle time fields
	if v, ok := metadata["createdAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			model.CreatedAt = t
		}
	}
	if v, ok := metadata["updatedAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			model.UpdatedAt = t
		}
	}
	
	return model, nil
}

func (s *PublishingService) storeAPIKey(namespace, modelName, apiKey string, metadata *APIKeyMetadata) error {
	// Store API key in Kubernetes secret
	secretName := fmt.Sprintf("published-model-apikey-%s", modelName)
	
	// Create secret data
	secretData := map[string]interface{}{
		"apiKey": apiKey,
		"keyId": metadata.KeyID,
		"modelName": metadata.ModelName,
		"namespace": metadata.Namespace,
		"tenantId": metadata.TenantID,
		"modelType": metadata.ModelType,
		"createdAt": metadata.CreatedAt.Format(time.RFC3339),
		"isActive": metadata.IsActive,
		"permissions": strings.Join(metadata.Permissions, ","),
	}
	
	// Add expiration if set
	if !metadata.ExpiresAt.IsZero() {
		secretData["expiresAt"] = metadata.ExpiresAt.Format(time.RFC3339)
	}
	
	// Store using K8s client
	return s.k8sClient.CreateAPIKeySecret(namespace, secretName, secretData)
}

func (s *PublishingService) validateAPIKey(apiKey string) (*APIKeyMetadata, error) {
	// Dynamically discover tenant namespaces
	namespaces, err := s.k8sClient.GetTenantNamespaces()
	if err != nil {
		log.Printf("Failed to get tenant namespaces, falling back to hardcoded list: %v", err)
		// Fallback to hardcoded list if discovery fails
		namespaces = []string{"tenant-a", "tenant-b", "tenant-c"}
	}
	
	for _, namespace := range namespaces {
		// Get all API key secrets in this namespace
		secrets, err := s.k8sClient.ListAPIKeySecrets(namespace)
		if err != nil {
			continue
		}
		
		for _, secret := range secrets {
			// Check if this secret contains the API key
			if storedKey, ok := secret["apiKey"].(string); ok && storedKey == apiKey {
				// Found matching API key, construct metadata
				metadata := &APIKeyMetadata{
					Namespace: namespace,
					IsActive:  true,
				}
				
				if keyID, ok := secret["keyId"].(string); ok {
					metadata.KeyID = keyID
				}
				if modelName, ok := secret["modelName"].(string); ok {
					metadata.ModelName = modelName
				}
				if tenantID, ok := secret["tenantId"].(string); ok {
					metadata.TenantID = tenantID
				}
				if modelType, ok := secret["modelType"].(string); ok {
					metadata.ModelType = modelType
				}
				if createdAt, ok := secret["createdAt"].(string); ok {
					if t, err := time.Parse(time.RFC3339, createdAt); err == nil {
						metadata.CreatedAt = t
					}
				}
				if permissions, ok := secret["permissions"].(string); ok {
					metadata.Permissions = strings.Split(permissions, ",")
				}
				
				return metadata, nil
			}
		}
	}
	
	return nil, fmt.Errorf("API key not found")
}

func (s *PublishingService) updateAPIKeyLastUsed(namespace, modelName string) {
	secretName := fmt.Sprintf("published-model-apikey-%s", modelName)
	
	// Get current secret
	secret, err := s.k8sClient.GetAPIKeySecret(namespace, secretName)
	if err != nil {
		// Log error but don't fail the request
		log.Printf("Failed to get API key secret for last used update: %v", err)
		return
	}
	
	// Update last used timestamp
	secret["lastUsed"] = time.Now().Format(time.RFC3339)
	
	// Update the secret
	if err := s.k8sClient.UpdateAPIKeySecret(namespace, secretName, secret); err != nil {
		// Log error but don't fail the request
		log.Printf("Failed to update API key last used timestamp: %v", err)
	}
}

// generateKeyID generates a unique key ID
func generateKeyID() string {
	return uuid.New().String()
}

func (s *PublishingService) logPublishingEvent(user *User, modelName, namespace, action string) {
	// Create audit log entry
	logEntry := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"user":      user.Name,
		"tenant":    user.Tenant,
		"action":    action,
		"model":     modelName,
		"namespace": namespace,
		"userAgent": "management-service",
	}
	
	// Store in ConfigMap for audit trail
	auditLogName := fmt.Sprintf("publishing-audit-%s", time.Now().Format("2006-01-02"))
	
	// Try to get existing audit log for today
	existingLog, err := s.k8sClient.GetConfigMap(namespace, auditLogName)
	if err != nil {
		// Create new audit log
		auditData := map[string]interface{}{
			"entries": []interface{}{logEntry},
		}
		s.k8sClient.CreateConfigMap(namespace, auditLogName, auditData)
	} else {
		// Append to existing audit log
		if entries, ok := existingLog["entries"].([]interface{}); ok {
			entries = append(entries, logEntry)
			existingLog["entries"] = entries
			s.k8sClient.UpdateConfigMap(namespace, auditLogName, existingLog)
		}
	}
}

// Cleanup methods
func (s *PublishingService) cleanupAPIKey(namespace, modelName string) {
	secretName := fmt.Sprintf("published-model-apikey-%s", modelName)
	
	if err := s.k8sClient.DeleteAPIKeySecret(namespace, secretName); err != nil {
		log.Printf("Failed to cleanup API key secret %s/%s: %v", namespace, secretName, err)
	}
}

func (s *PublishingService) cleanupGatewayConfiguration(namespace, modelName string) {
	routeName := fmt.Sprintf("published-model-%s-%s", namespace, modelName)
	backendName := fmt.Sprintf("%s-backend", modelName)
	aiServiceBackendName := backendName + "-ai"
	grantName := fmt.Sprintf("published-model-grant-%s-%s", namespace, modelName)
	
	// Delete HTTPRoute
	if err := s.k8sClient.DeleteHTTPRoute("envoy-gateway-system", routeName); err != nil {
		log.Printf("Failed to cleanup HTTPRoute %s: %v", routeName, err)
	}
	
	// Delete AIGatewayRoute
	if err := s.k8sClient.DeleteAIGatewayRoute("envoy-gateway-system", routeName); err != nil {
		log.Printf("Failed to cleanup AIGatewayRoute %s: %v", routeName, err)
	}
	
	// Delete AIServiceBackend
	if err := s.k8sClient.DeleteAIServiceBackend("envoy-gateway-system", aiServiceBackendName); err != nil {
		log.Printf("Failed to cleanup AIServiceBackend %s: %v", aiServiceBackendName, err)
	}
	
	// Delete Backend
	if err := s.k8sClient.DeleteBackend("envoy-gateway-system", backendName); err != nil {
		log.Printf("Failed to cleanup Backend %s: %v", backendName, err)
	}
	
	
	// Delete ReferenceGrant (now in istio-system)
	if err := s.k8sClient.DeleteReferenceGrant("istio-system", grantName); err != nil {
		log.Printf("Failed to cleanup ReferenceGrant istio-system/%s: %v", grantName, err)
	}
}

func (s *PublishingService) cleanupRateLimitingPolicy(namespace, modelName string) {
	policyName := fmt.Sprintf("published-model-rate-limit-%s-%s", namespace, modelName)
	
	if err := s.k8sClient.DeleteBackendTrafficPolicy("envoy-gateway-system", policyName); err != nil {
		log.Printf("Failed to cleanup BackendTrafficPolicy %s: %v", policyName, err)
	}
}

func (s *PublishingService) cleanupPublishedModelMetadata(namespace, modelName string) {
	if err := s.k8sClient.DeletePublishedModelMetadata(namespace, modelName); err != nil {
		log.Printf("Failed to cleanup published model metadata %s/%s: %v", namespace, modelName, err)
	}
}


// createBackend creates a Backend resource that routes traffic to the KServe VirtualService.
// 
// The Backend resource uses FQDN to point directly to the KServe model VirtualService hostname,
// allowing the AI Gateway to route through the Istio service mesh to reach the model endpoint.
//
// Parameters:
// - namespace: The namespace of the tenant owning the model.
// - modelName: The name of the model being published.
// - backendName: The name of the Backend resource to create.
// - kserveHostname: The hostname of the KServe inference service VirtualService.
//
// Returns:
// - An error if the Backend resource creation fails.
func (s *PublishingService) createBackend(namespace, modelName, backendName, kserveHostname string) error {
	// Create Backend resource with FQDN endpoint configuration:
	// - FQDN: KServe VirtualService hostname for proper Istio routing
	backend := map[string]interface{}{
		"apiVersion": "gateway.envoyproxy.io/v1alpha1",
		"kind":       "Backend",
		"metadata": map[string]interface{}{
			"name":      backendName,
			"namespace": "envoy-gateway-system",
			"labels": map[string]interface{}{
				"app":        "published-model",
				"model-name": modelName,
				"tenant":     namespace,
				"kserve-hostname": kserveHostname,
			},
		},
		"spec": map[string]interface{}{
			"endpoints": []interface{}{
				map[string]interface{}{
					"fqdn": map[string]interface{}{
						"hostname": kserveHostname,
						"port":     80,
					},
				},
			},
		},
	}

	return s.k8sClient.CreateBackend("envoy-gateway-system", backend)
}

// createAIServiceBackend creates an AIServiceBackend resource that references a Backend resource.
// 
// The AIServiceBackend is a custom resource used to define AI service-specific configurations,
// such as OpenAI schema and request timeouts, while delegating traffic routing to the referenced Backend.
// The Backend resource contains FQDN (KServe VirtualService hostname) for routing through the Istio service mesh.
//
// Architecture:
// Client -> AI Gateway -> AIServiceBackend -> Backend (FQDN: KServe VirtualService) -> Istio Service Mesh -> KServe Model
//
// Parameters:
// - namespace: The namespace of the tenant owning the model.
// - modelName: The name of the model being published.
// - backendName: The name of the Backend resource to reference.
// - kserveHostname: The hostname of the KServe inference service VirtualService.
//
// Returns:
// - An error if the AIServiceBackend resource creation fails.
func (s *PublishingService) createAIServiceBackend(namespace, modelName, backendName, kserveHostname string) error {
	// Create AIServiceBackend resource that references the Backend for traffic routing
	// The Backend contains FQDN (KServe VirtualService) for routing through Istio service mesh
	aiServiceBackend := map[string]interface{}{
		"apiVersion": "aigateway.envoyproxy.io/v1alpha1",
		"kind":       "AIServiceBackend",
		"metadata": map[string]interface{}{
			"name":      backendName + "-ai",
			"namespace": "envoy-gateway-system",
			"labels": map[string]interface{}{
				"app":        "published-model",
				"model-name": modelName,
				"tenant":     namespace,
				"kserve-hostname": kserveHostname,
			},
		},
		"spec": map[string]interface{}{
			"schema": map[string]interface{}{
				"name": "OpenAI",
			},
			// Reference the Backend resource that routes to istio-ingressgateway
			"backendRef": map[string]interface{}{
				"name":      backendName,
				"namespace": "envoy-gateway-system",
				"kind":      "Backend",
				"group":     "gateway.envoyproxy.io",
			},
			"timeouts": map[string]interface{}{
				"request": "60s",
			},
		},
	}

	return s.k8sClient.CreateAIServiceBackend("envoy-gateway-system", aiServiceBackend)
}

func (s *PublishingService) createReferenceGrant(namespace, modelName string) error {
	// Create ReferenceGrant for cross-namespace access from envoy-gateway-system to istio-system
	// This allows AIServiceBackend to access istio-ingressgateway service
	grantName := fmt.Sprintf("published-model-grant-%s-%s", namespace, modelName)
	
	referenceGrant := map[string]interface{}{
		"apiVersion": "gateway.networking.k8s.io/v1beta1",
		"kind":       "ReferenceGrant",
		"metadata": map[string]interface{}{
			"name":      grantName,
			"namespace": "istio-system",
			"labels": map[string]interface{}{
				"app":        "published-model",
				"model-name": modelName,
				"tenant":     namespace,
			},
		},
		"spec": map[string]interface{}{
			"from": []interface{}{
				map[string]interface{}{
					"group":     "aigateway.envoyproxy.io",
					"kind":      "AIServiceBackend",
					"namespace": "envoy-gateway-system",
				},
			},
			"to": []interface{}{
				map[string]interface{}{
					"group": "",
					"kind":  "Service",
					"name":  "istio-ingressgateway",
				},
			},
		},
	}

	return s.k8sClient.CreateReferenceGrant("istio-system", referenceGrant)
}


// updateGatewayForHostname intelligently updates the Gateway resource for hostname support
func (s *PublishingService) updateGatewayForHostname(hostname string) error {
	gatewayNamespace := "envoy-gateway-system"
	gatewayName := "ai-inference-gateway"
	
	// Check if hostname is already covered by wildcard patterns
	if s.isHostnameCoveredByWildcard(hostname) {
		log.Printf("Hostname %s is already covered by wildcard patterns, skipping gateway update", hostname)
		return nil
	}
	
	// Get the current Gateway configuration
	gateway, err := s.k8sClient.GetGateway(gatewayNamespace, gatewayName)
	if err != nil {
		return fmt.Errorf("failed to get gateway %s/%s: %w", gatewayNamespace, gatewayName, err)
	}
	
	// Extract the spec
	spec, ok := gateway["spec"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("gateway spec is not a map")
	}
	
	// Extract listeners
	listeners, ok := spec["listeners"].([]interface{})
	if !ok {
		return fmt.Errorf("gateway listeners is not an array")
	}
	
	// Check if hostname already exists in any listener
	if s.hostnameExistsInListeners(listeners, hostname) {
		log.Printf("Hostname %s already exists in gateway listeners", hostname)
		return nil
	}
	
	// Add hostname to appropriate listeners if needed
	updatedListeners, updated := s.addHostnameToListeners(listeners, hostname)
	
	if updated {
		// Update the listeners in the spec
		spec["listeners"] = updatedListeners
		
		// Update the Gateway resource
		if err := s.k8sClient.UpdateGateway(gatewayNamespace, gateway); err != nil {
			return fmt.Errorf("failed to update gateway: %w", err)
		}
		
		log.Printf("Updated Gateway %s/%s to include hostname: %s", gatewayNamespace, gatewayName, hostname)
	}
	
	return nil
}

// isHostnameCoveredByWildcard checks if hostname is covered by existing wildcard patterns
func (s *PublishingService) isHostnameCoveredByWildcard(hostname string) bool {
	// Check if hostname matches *.inference-in-a-box pattern
	if strings.HasSuffix(hostname, ".inference-in-a-box") {
		return true
	}
	
	// Check if it's the default hostname
	if hostname == "api.router.inference-in-a-box" {
		return true
	}
	
	return false
}

// hostnameExistsInListeners checks if hostname already exists in listeners
func (s *PublishingService) hostnameExistsInListeners(listeners []interface{}, hostname string) bool {
	for _, listener := range listeners {
		if l, ok := listener.(map[string]interface{}); ok {
			if existingHostname, exists := l["hostname"]; exists {
				if existingHostname == hostname {
					return true
				}
			}
		}
	}
	return false
}

// addHostnameToListeners adds hostname to listeners if needed, returns updated listeners and bool if updated
func (s *PublishingService) addHostnameToListeners(listeners []interface{}, hostname string) ([]interface{}, bool) {
	updated := false
	
	// For custom hostnames that don't match our patterns, add specific listeners
	if !s.isHostnameCoveredByWildcard(hostname) {
		// Add to both HTTP and HTTPS listeners as new listeners
		httpListener := map[string]interface{}{
			"name":     fmt.Sprintf("http-custom-%s", s.sanitizeHostnameForName(hostname)),
			"protocol": "HTTP",
			"port":     80,
			"hostname": hostname,
			"allowedRoutes": map[string]interface{}{
				"namespaces": map[string]interface{}{
					"from": "All",
				},
			},
		}
		
		httpsListener := map[string]interface{}{
			"name":     fmt.Sprintf("https-custom-%s", s.sanitizeHostnameForName(hostname)),
			"protocol": "HTTPS",
			"port":     443,
			"hostname": hostname,
			"allowedRoutes": map[string]interface{}{
				"namespaces": map[string]interface{}{
					"from": "All",
				},
			},
			"tls": map[string]interface{}{
				"mode": "Terminate",
				"certificateRefs": []interface{}{
					map[string]interface{}{
						"kind": "Secret",
						"name": "ai-gateway-tls",
					},
				},
				"options": map[string]interface{}{
					"tls.cipher_suites":       "ECDHE-ECDSA-AES128-GCM-SHA256,ECDHE-RSA-AES128-GCM-SHA256",
					"tls.min_protocol_version": "TLSv1.2",
					"tls.max_protocol_version": "TLSv1.3",
				},
			},
		}
		
		// Append new listeners
		listeners = append(listeners, httpListener, httpsListener)
		updated = true
	}
	
	return listeners, updated
}

// sanitizeHostnameForName converts hostname to valid Kubernetes name format
func (s *PublishingService) sanitizeHostnameForName(hostname string) string {
	// Replace dots and other invalid characters with dashes
	sanitized := strings.ReplaceAll(hostname, ".", "-")
	sanitized = strings.ReplaceAll(sanitized, "_", "-")
	
	// Ensure it's not too long and is valid
	if len(sanitized) > 40 {
		sanitized = sanitized[:40]
	}
	
	return strings.ToLower(sanitized)
}

