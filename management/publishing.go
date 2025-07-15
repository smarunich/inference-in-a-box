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
		ModelName:     modelName,
		Namespace:     namespace,
		TenantID:      namespace,
		ModelType:     modelType,
		ExternalURL:   externalURL,
		APIKey:        apiKey,
		RateLimiting:  req.Config.RateLimiting,
		Status:        "active",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
		Usage:         UsageStats{},
		Documentation: documentation,
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
	
	// Check for OpenAI-compatible annotations or labels
	metadata, ok := inferenceService["metadata"].(map[string]interface{})
	if ok {
		if annotations, ok := metadata["annotations"].(map[string]interface{}); ok {
			if modelType, exists := annotations["model.type"]; exists {
				if modelType == "openai" {
					return "openai", nil
				}
			}
		}
	}
	
	// Check for specific predictor configurations that indicate OpenAI compatibility
	if predictor, ok := spec["predictor"].(map[string]interface{}); ok {
		if containers, ok := predictor["containers"].([]interface{}); ok {
			for _, container := range containers {
				if c, ok := container.(map[string]interface{}); ok {
					if image, ok := c["image"].(string); ok {
						// Check if the image suggests OpenAI compatibility
						if strings.Contains(image, "openai") || strings.Contains(image, "llama") || strings.Contains(image, "huggingface") {
							return "openai", nil
						}
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
			},
		},
		"spec": map[string]interface{}{
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
									"type": "Present",
								},
							},
						},
					},
					"filters": []interface{}{
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
	
	// Create the HTTPRoute
	if err := s.k8sClient.CreateHTTPRoute("envoy-gateway-system", httpRoute); err != nil {
		return "", fmt.Errorf("failed to create HTTPRoute: %w", err)
	}
	
	// Return the external URL
	return fmt.Sprintf("https://gateway.example.com%s", externalPath), nil
}

func (s *PublishingService) createAIGatewayRoute(namespace, modelName, routeName string, config PublishConfig) (string, error) {
	// Generate external path for OpenAI compatibility
	externalPath := config.ExternalPath
	if externalPath == "" {
		externalPath = fmt.Sprintf("/v1/models/%s", modelName)
	}
	
	// Create AIGatewayRoute configuration
	aiGatewayRoute := map[string]interface{}{
		"apiVersion": "gateway.ai/v1alpha1",
		"kind":       "AIGatewayRoute",
		"metadata": map[string]interface{}{
			"name":      routeName,
			"namespace": "envoy-gateway-system",
			"labels": map[string]interface{}{
				"app":        "published-model",
				"model-name": modelName,
				"tenant":     namespace,
				"type":       "openai",
			},
		},
		"spec": map[string]interface{}{
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
									"type": "Present",
								},
							},
						},
					},
					"filters": []interface{}{
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
										"name":  "x-model-type",
										"value": "openai",
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
			"openai": map[string]interface{}{
				"enabled":    true,
				"modelName":  modelName,
				"namespace":  namespace,
				"tokenLimit": config.RateLimiting.TokensPerHour,
			},
		},
	}
	
	// Create the AIGatewayRoute
	if err := s.k8sClient.CreateAIGatewayRoute("envoy-gateway-system", aiGatewayRoute); err != nil {
		return "", fmt.Errorf("failed to create AIGatewayRoute: %w", err)
	}
	
	// Return the external URL
	return fmt.Sprintf("https://gateway.example.com%s", externalPath), nil
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
											"type":  "Present",
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
		"modelName":     model.ModelName,
		"namespace":     model.Namespace,
		"tenantId":      model.TenantID,
		"modelType":     model.ModelType,
		"externalUrl":   model.ExternalURL,
		"apiKey":        model.APIKey,
		"rateLimiting":  model.RateLimiting,
		"status":        model.Status,
		"createdAt":     model.CreatedAt,
		"updatedAt":     model.UpdatedAt,
		"usage":         model.Usage,
		"documentation": model.Documentation,
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
	// Search for API key across all namespaces
	namespaces := []string{"tenant-a", "tenant-b", "tenant-c"}
	
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
	
	// Delete HTTPRoute
	if err := s.k8sClient.DeleteHTTPRoute("envoy-gateway-system", routeName); err != nil {
		log.Printf("Failed to cleanup HTTPRoute %s: %v", routeName, err)
	}
	
	// Delete AIGatewayRoute
	if err := s.k8sClient.DeleteAIGatewayRoute("envoy-gateway-system", routeName); err != nil {
		log.Printf("Failed to cleanup AIGatewayRoute %s: %v", routeName, err)
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

