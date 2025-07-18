package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type ModelService struct {
	k8sClient *K8sClient
	config    *Config
}

func NewModelService(k8sClient *K8sClient) *ModelService {
	return &ModelService{
		k8sClient: k8sClient,
		config:    NewConfig(),
	}
}

// ListModels handles GET /api/models
func (s *ModelService) ListModels(c *gin.Context) {
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

	var namespace string
	if u.IsAdmin {
		// Admin can see all models across all namespaces
		namespace = ""
	} else {
		// Regular users see only their tenant models
		namespace = u.Tenant
	}

	// Get inference services from Kubernetes
	inferenceServices, err := s.k8sClient.GetInferenceServices(namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to list models",
			Details: err.Error(),
		})
		return
	}

	// Convert to ModelInfo structs
	var models []ModelInfo
	for _, obj := range inferenceServices {
		modelInfo := ConvertToModelInfo(obj)
		models = append(models, modelInfo)
	}

	c.JSON(http.StatusOK, ModelListResponse{
		Models: models,
	})
}

// GetModel handles GET /api/models/:modelName
func (s *ModelService) GetModel(c *gin.Context) {
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

	modelName := c.Param("modelName")
	tenant := u.Tenant

	// Get inference service from Kubernetes
	obj, err := s.k8sClient.GetInferenceService(tenant, modelName)
	if err != nil {
		if IsResourceNotFoundError(err) {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: "Model not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "Failed to get model",
				Details: err.Error(),
			})
		}
		return
	}

	// Convert to ModelInfo
	modelInfo := ConvertToModelInfo(obj)
	c.JSON(http.StatusOK, modelInfo)
}

// CreateModel handles POST /api/models
func (s *ModelService) CreateModel(c *gin.Context) {
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

	var req ModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	// Validate required fields
	if req.Name == "" || req.Framework == "" || req.StorageUri == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "Missing required fields: name, framework, storageUri",
		})
		return
	}

	// Validate framework
	if !s.config.IsValidFramework(req.Framework) {
		supportedFrameworks := make([]string, len(s.config.SupportedFrameworks))
		for i, fw := range s.config.SupportedFrameworks {
			supportedFrameworks[i] = fw.Name
		}
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: fmt.Sprintf("Unsupported framework. Supported: %s", strings.Join(supportedFrameworks, ", ")),
		})
		return
	}

	// Determine namespace
	var tenant string
	if u.IsAdmin && req.Namespace != "" {
		tenant = req.Namespace
	} else {
		tenant = u.Tenant
	}

	// Create model configuration
	config := ModelConfig{
		Framework:   req.Framework,
		StorageUri:  req.StorageUri,
		MinReplicas: 1,
		MaxReplicas: 3,
		ScaleTarget: 60,
		ScaleMetric: "concurrency",
	}

	// Set optional parameters
	if req.MinReplicas != nil {
		config.MinReplicas = *req.MinReplicas
	}
	if req.MaxReplicas != nil {
		config.MaxReplicas = *req.MaxReplicas
	}
	if req.ScaleTarget != nil {
		config.ScaleTarget = *req.ScaleTarget
	}
	if req.ScaleMetric != "" {
		config.ScaleMetric = req.ScaleMetric
	}

	// Generate model YAML
	modelSpec, err := GenerateModelYAML(req.Name, tenant, config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to generate model specification",
			Details: err.Error(),
		})
		return
	}

	// Create inference service
	if err := s.k8sClient.CreateInferenceService(tenant, modelSpec); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create model",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, ModelResponse{
		Message:   "Model created successfully",
		Name:      req.Name,
		Namespace: tenant,
		Config:    config,
	})
}

// UpdateModel handles PUT /api/models/:modelName
func (s *ModelService) UpdateModel(c *gin.Context) {
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

	modelName := c.Param("modelName")
	tenant := u.Tenant

	var req ModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	// Get existing model
	existingObj, err := s.k8sClient.GetInferenceService(tenant, modelName)
	if err != nil {
		if IsResourceNotFoundError(err) {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: "Model not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "Failed to get existing model",
				Details: err.Error(),
			})
		}
		return
	}

	// Extract current configuration
	currentConfig := ModelConfig{
		MinReplicas: 1,
		MaxReplicas: 3,
		ScaleTarget: 60,
		ScaleMetric: "concurrency",
	}

	// Parse existing spec
	if spec, ok := existingObj["spec"].(map[string]interface{}); ok {
		if predictor, ok := spec["predictor"].(map[string]interface{}); ok {
			if minReplicas, ok := predictor["minReplicas"].(float64); ok {
				currentConfig.MinReplicas = int(minReplicas)
			}
			if maxReplicas, ok := predictor["maxReplicas"].(float64); ok {
				currentConfig.MaxReplicas = int(maxReplicas)
			}
			if scaleTarget, ok := predictor["scaleTarget"].(float64); ok {
				currentConfig.ScaleTarget = int(scaleTarget)
			}
			if scaleMetric, ok := predictor["scaleMetric"].(string); ok {
				currentConfig.ScaleMetric = scaleMetric
			}

			// Find the framework and storage URI
			for _, framework := range s.config.SupportedFrameworks {
				if frameworkConfig, ok := predictor[framework.Name].(map[string]interface{}); ok {
					currentConfig.Framework = framework.Name
					if storageUri, ok := frameworkConfig["storageUri"].(string); ok {
						currentConfig.StorageUri = storageUri
					}
					break
				}
			}
		}
	}

	// Update with new values
	if req.Framework != "" {
		currentConfig.Framework = req.Framework
	}
	if req.StorageUri != "" {
		currentConfig.StorageUri = req.StorageUri
	}
	if req.MinReplicas != nil {
		currentConfig.MinReplicas = *req.MinReplicas
	}
	if req.MaxReplicas != nil {
		currentConfig.MaxReplicas = *req.MaxReplicas
	}
	if req.ScaleTarget != nil {
		currentConfig.ScaleTarget = *req.ScaleTarget
	}
	if req.ScaleMetric != "" {
		currentConfig.ScaleMetric = req.ScaleMetric
	}

	// Generate updated model YAML
	modelSpec, err := GenerateModelYAML(modelName, tenant, currentConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to generate model specification",
			Details: err.Error(),
		})
		return
	}

	// Update inference service
	if err := s.k8sClient.UpdateInferenceService(tenant, modelName, modelSpec); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to update model",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, ModelResponse{
		Message:   "Model updated successfully",
		Name:      modelName,
		Namespace: tenant,
		Config:    currentConfig,
	})
}

// DeleteModel handles DELETE /api/models/:modelName
func (s *ModelService) DeleteModel(c *gin.Context) {
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

	modelName := c.Param("modelName")
	tenant := u.Tenant

	// Delete inference service
	if err := s.k8sClient.DeleteInferenceService(tenant, modelName); err != nil {
		if IsResourceNotFoundError(err) {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: "Model not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "Failed to delete model",
				Details: err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, ModelResponse{
		Message:   "Model deleted successfully",
		Name:      modelName,
		Namespace: tenant,
	})
}

// PredictModel handles POST /api/models/:modelName/predict
func (s *ModelService) PredictModel(c *gin.Context) {
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

	modelName := c.Param("modelName")

	var req PredictRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	// Marshal input data
	inputDataJSON, err := json.Marshal(req.InputData)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	var modelUrl string
	var fullPath string

	if req.ConnectionSettings != nil && req.ConnectionSettings.UseCustom {
		// Use custom connection settings
		protocol := req.ConnectionSettings.Protocol
		host := req.ConnectionSettings.Host
		port := req.ConnectionSettings.Port
		path := req.ConnectionSettings.Path

		if protocol == "" {
			protocol = "http"
		}

		portPart := ""
		if port != "" {
			portPart = ":" + port
		}

		if path == "" {
			path = fmt.Sprintf("/v1/models/%s:predict", modelName)
		}

		modelUrl = fmt.Sprintf("%s://%s%s", protocol, host, portPart)
		fullPath = path
	} else {
		// Default behavior - get model URL from InferenceService
		tenant := u.Tenant
		if u.IsAdmin && req.ConnectionSettings != nil && req.ConnectionSettings.Namespace != "" {
			tenant = req.ConnectionSettings.Namespace
		}

		// Get model URL from InferenceService status
		obj, err := s.k8sClient.GetInferenceService(tenant, modelName)
		if err != nil {
			if IsResourceNotFoundError(err) {
				c.JSON(http.StatusNotFound, ErrorResponse{
					Error: "Model not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, ErrorResponse{
					Error:   "Failed to get model",
					Details: err.Error(),
				})
			}
			return
		}

		// Extract model URL from status
		if status, ok := obj["status"].(map[string]interface{}); ok {
			if url, ok := status["url"].(string); ok {
				modelUrl = url
			}
		}

		if modelUrl == "" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: "Model not ready or not found",
			})
			return
		}

		fullPath = fmt.Sprintf("/v1/models/%s:predict", modelName)
	}

	// Build full URL
	requestURL := modelUrl + fullPath

	// Create HTTP request
	httpReq, err := http.NewRequest("POST", requestURL, bytes.NewBuffer(inputDataJSON))
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create HTTP request",
			Details: err.Error(),
		})
		return
	}

	// Set default Content-Type header
	httpReq.Header.Set("Content-Type", "application/json")

	// Add custom headers if provided
	if req.ConnectionSettings != nil && req.ConnectionSettings.Headers != nil {
		for _, header := range req.ConnectionSettings.Headers {
			if header.Key != "" && header.Value != "" {
				if strings.ToLower(header.Key) == "host" {
					// Special handling for Host header
					httpReq.Host = header.Value
				} else {
					httpReq.Header.Set(header.Key, header.Value)
				}
			}
		}
	}

	// Create HTTP client with custom DNS resolution if needed
	client := s.createHTTPClient(req.ConnectionSettings)

	// Execute HTTP request
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to make prediction request",
			Details: err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// Read response body
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to read response",
			Details: err.Error(),
		})
		return
	}

	// Check if response status is not successful
	if resp.StatusCode >= 400 {
		c.JSON(http.StatusBadGateway, ErrorResponse{
			Error:   fmt.Sprintf("Model prediction failed with status %d", resp.StatusCode),
			Details: string(responseBody),
		})
		return
	}

	// Parse prediction result
	var prediction interface{}
	if err := json.Unmarshal(responseBody, &prediction); err != nil {
		// If JSON parsing fails, return raw response
		c.JSON(http.StatusOK, map[string]interface{}{
			"raw_response": string(responseBody),
			"status_code":  resp.StatusCode,
		})
		return
	}

	c.JSON(http.StatusOK, prediction)
}

// createHTTPClient creates an HTTP client with custom DNS resolution support
func (s *ModelService) createHTTPClient(settings *ConnectionSettings) *http.Client {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// If no DNS resolution overrides, return default client
	if settings == nil || len(settings.DNSResolve) == 0 {
		return client
	}

	// Build DNS resolution map
	dnsResolveMap := make(map[string]string)
	for _, resolve := range settings.DNSResolve {
		if resolve.Host != "" && resolve.Port != "" && resolve.Address != "" {
			// Create address key (host:port)
			addressKey := resolve.Host + ":" + resolve.Port
			// Set IP:port as the target
			dnsResolveMap[addressKey] = resolve.Address + ":" + resolve.Port
		}
	}

	// Create custom dialer
	dialer := &net.Dialer{
		Timeout: 30 * time.Second,
	}

	// Create custom transport with DNS override
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// Check if this address needs DNS override
			if dnsOverride, exists := dnsResolveMap[addr]; exists {
				// Use the override address
				addr = dnsOverride
			}
			return dialer.DialContext(ctx, network, addr)
		},
	}

	client.Transport = transport
	return client
}

// GetModelLogs handles GET /api/models/:modelName/logs
func (s *ModelService) GetModelLogs(c *gin.Context) {
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

	modelName := c.Param("modelName")
	tenant := u.Tenant

	// Get lines parameter
	lines := 100
	if linesParam := c.Query("lines"); linesParam != "" {
		if parsedLines, err := strconv.Atoi(linesParam); err == nil {
			lines = parsedLines
		}
	}

	// Get model logs
	logs, err := s.k8sClient.GetModelLogs(tenant, modelName, lines)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get logs",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, LogsResponse{
		Logs: logs,
	})
}

// GetFrameworks handles GET /api/frameworks
func (s *ModelService) GetFrameworks(c *gin.Context) {
	c.JSON(http.StatusOK, FrameworksResponse{
		Frameworks: s.config.SupportedFrameworks,
	})
}