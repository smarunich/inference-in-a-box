package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type TestExecutionService struct {
	publishingService *PublishingService
	config            *Config
}

func NewTestExecutionService(publishingService *PublishingService, config *Config) *TestExecutionService {
	return &TestExecutionService{
		publishingService: publishingService,
		config:            config,
	}
}

// ExecuteTest handles POST /api/test/execute
func (s *TestExecutionService) ExecuteTest(c *gin.Context) {
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

	var req TestExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	startTime := time.Now()
	
	// Execute the test
	testResult := s.executeModelTest(req, u)
	
	// Calculate response time
	testResult.ResponseTime = time.Since(startTime).Milliseconds()
	testResult.Timestamp = time.Now()

	// Return the test result
	c.JSON(http.StatusOK, testResult)
}

func (s *TestExecutionService) executeModelTest(req TestExecutionRequest, user *User) TestExecutionResponse {
	var endpoint string
	var headers map[string]string
	var method string

	// If using custom configuration, use that
	if req.UseCustomConfig {
		endpoint = req.CustomEndpoint
		method = req.CustomMethod
		if method == "" {
			method = "POST"
		}
		
		// Build headers from custom configuration
		headers = make(map[string]string)
		for _, header := range req.CustomHeaders {
			if header.Key != "" && header.Value != "" {
				headers[header.Key] = header.Value
			}
		}
		
		// Ensure Content-Type is set
		if headers["Content-Type"] == "" {
			headers["Content-Type"] = "application/json"
		}
	} else {
		// Use published model configuration
		publishedModel, err := s.publishingService.getPublishedModelMetadata(user.Tenant, req.ModelName)
		if err != nil {
			return TestExecutionResponse{
				Success:    false,
				Error:      fmt.Sprintf("Failed to get published model: %v", err),
				Request:    req.TestData,
				Endpoint:   "",
				Status:     "Model Not Found",
				StatusCode: 404,
			}
		}

		// Determine the endpoint based on model type
		if publishedModel.ModelType == "openai" {
			endpoint = fmt.Sprintf("%s/chat/completions", publishedModel.ExternalURL)
		} else {
			endpoint = fmt.Sprintf("%s/predict", publishedModel.ExternalURL)
		}
		
		method = "POST"
		headers = map[string]string{
			"Content-Type": "application/json",
			"X-API-Key":    publishedModel.APIKey,
		}
	}

	// Marshal the test data
	requestBody, err := json.Marshal(req.TestData)
	if err != nil {
		return TestExecutionResponse{
			Success:    false,
			Error:      fmt.Sprintf("Failed to marshal test data: %v", err),
			Request:    req.TestData,
			Endpoint:   endpoint,
			Status:     "Invalid Request Data",
			StatusCode: 400,
		}
	}

	// Create HTTP request
	httpReq, err := http.NewRequest(method, endpoint, bytes.NewBuffer(requestBody))
	if err != nil {
		return TestExecutionResponse{
			Success:    false,
			Error:      fmt.Sprintf("Failed to create HTTP request: %v", err),
			Request:    req.TestData,
			Endpoint:   endpoint,
			Status:     "Request Creation Failed",
			StatusCode: 500,
		}
	}

	// Set headers
	for key, value := range headers {
		httpReq.Header.Set(key, value)
	}

	// Execute the request
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	
	resp, err := client.Do(httpReq)
	if err != nil {
		return TestExecutionResponse{
			Success:    false,
			Error:      fmt.Sprintf("Request failed: %v", err),
			Request:    req.TestData,
			Endpoint:   endpoint,
			Status:     "Network Error",
			StatusCode: 0,
		}
	}
	defer resp.Body.Close()

	// Read response body
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return TestExecutionResponse{
			Success:    false,
			Error:      fmt.Sprintf("Failed to read response: %v", err),
			Request:    req.TestData,
			Endpoint:   endpoint,
			Status:     resp.Status,
			StatusCode: resp.StatusCode,
		}
	}

	// Parse response JSON
	var responseData interface{}
	if err := json.Unmarshal(responseBody, &responseData); err != nil {
		// If JSON parsing fails, return raw response
		responseData = string(responseBody)
	}

	// Convert headers to map
	responseHeaders := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			responseHeaders[key] = values[0]
		}
	}

	// Determine success based on status code
	success := resp.StatusCode >= 200 && resp.StatusCode < 300

	result := TestExecutionResponse{
		Success:    success,
		Data:       responseData,
		Request:    req.TestData,
		Endpoint:   endpoint,
		Status:     resp.Status,
		StatusCode: resp.StatusCode,
		Headers:    responseHeaders,
	}

	// Set error message if not successful
	if !success {
		if errorMsg, ok := responseData.(map[string]interface{}); ok {
			if errStr, exists := errorMsg["error"]; exists {
				result.Error = fmt.Sprintf("%v", errStr)
			} else {
				result.Error = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, resp.Status)
			}
		} else {
			result.Error = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, resp.Status)
		}
	}

	return result
}

// GetTestHistory handles GET /api/test/history
func (s *TestExecutionService) GetTestHistory(c *gin.Context) {
	// For now, return empty history since we're not persisting test results
	// This could be extended to store test results in a database or cache
	c.JSON(http.StatusOK, TestHistoryResponse{
		Tests: []TestExecutionResponse{},
		Total: 0,
	})
}

// ValidateTestRequest handles POST /api/test/validate
func (s *TestExecutionService) ValidateTestRequest(c *gin.Context) {
	var req TestExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	// Validate test data JSON
	if req.TestData == nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "Test data is required",
		})
		return
	}

	// Try to marshal the test data to validate it's valid JSON
	if _, err := json.Marshal(req.TestData); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid test data format",
			Details: err.Error(),
		})
		return
	}

	// Validate custom endpoint if provided
	if req.UseCustomConfig && req.CustomEndpoint != "" {
		if !strings.HasPrefix(req.CustomEndpoint, "http://") && !strings.HasPrefix(req.CustomEndpoint, "https://") {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error: "Custom endpoint must be a valid HTTP/HTTPS URL",
			})
			return
		}
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"valid":   true,
		"message": "Test request is valid",
	})
}