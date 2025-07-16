package main

import (
	"fmt"
	"log"
	"strings"
	"time"
)

// PublishingError represents a publishing-specific error with context
type PublishingError struct {
	Code      string
	Message   string
	Details   string
	Cause     error
	Namespace string
	ModelName string
	Step      string
}

func (e *PublishingError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("%s: %s - %s", e.Code, e.Message, e.Details)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *PublishingError) Unwrap() error {
	return e.Cause
}

// NewPublishingError creates a new publishing error
func NewPublishingError(code, message, namespace, modelName, step string, cause error) *PublishingError {
	details := ""
	if cause != nil {
		details = cause.Error()
	}
	
	return &PublishingError{
		Code:      code,
		Message:   message,
		Details:   details,
		Cause:     cause,
		Namespace: namespace,
		ModelName: modelName,
		Step:      step,
	}
}

// PublishingRollback handles rollback operations when publishing fails
type PublishingRollback struct {
	service   *PublishingService
	namespace string
	modelName string
	steps     []string
}

// NewPublishingRollback creates a new rollback handler
func NewPublishingRollback(service *PublishingService, namespace, modelName string) *PublishingRollback {
	return &PublishingRollback{
		service:   service,
		namespace: namespace,
		modelName: modelName,
		steps:     make([]string, 0),
	}
}

// AddStep adds a step to the rollback list
func (r *PublishingRollback) AddStep(step string) {
	r.steps = append(r.steps, step)
}

// Execute performs the rollback operations
func (r *PublishingRollback) Execute() {
	log.Printf("Starting rollback for model %s/%s", r.namespace, r.modelName)
	
	// Rollback in reverse order
	for i := len(r.steps) - 1; i >= 0; i-- {
		step := r.steps[i]
		log.Printf("Rolling back step: %s", step)
		
		switch step {
		case "api_key":
			r.service.cleanupAPIKey(r.namespace, r.modelName)
		case "gateway_config":
			r.service.cleanupGatewayConfiguration(r.namespace, r.modelName)
		case "rate_limiting":
			r.service.cleanupRateLimitingPolicy(r.namespace, r.modelName)
		case "metadata":
			r.service.cleanupPublishedModelMetadata(r.namespace, r.modelName)
		default:
			log.Printf("Unknown rollback step: %s", step)
		}
	}
	
	log.Printf("Rollback completed for model %s/%s", r.namespace, r.modelName)
}

// ValidationError represents validation errors during publishing
type ValidationError struct {
	Field   string
	Value   interface{}
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation error for field '%s': %s", e.Field, e.Message)
}

// PublishingValidator handles validation of publishing requests
type PublishingValidator struct {
	service *PublishingService
}

// NewPublishingValidator creates a new validator
func NewPublishingValidator(service *PublishingService) *PublishingValidator {
	return &PublishingValidator{
		service: service,
	}
}

// ValidatePublishRequest validates a publish request
func (v *PublishingValidator) ValidatePublishRequest(namespace, modelName string, config PublishConfig) []ValidationError {
	var errors []ValidationError
	
	// Validate model exists and is ready
	if err := v.service.validateModelExists(namespace, modelName); err != nil {
		errors = append(errors, ValidationError{
			Field:   "model",
			Value:   modelName,
			Message: fmt.Sprintf("Model validation failed: %v", err),
		})
	}
	
	// Validate tenant ID
	if config.TenantID == "" {
		errors = append(errors, ValidationError{
			Field:   "tenantId",
			Value:   config.TenantID,
			Message: "Tenant ID is required",
		})
	}
	
	// Validate rate limiting configuration
	if config.RateLimiting.RequestsPerMinute <= 0 {
		errors = append(errors, ValidationError{
			Field:   "rateLimiting.requestsPerMinute",
			Value:   config.RateLimiting.RequestsPerMinute,
			Message: "Requests per minute must be greater than 0",
		})
	}
	
	if config.RateLimiting.RequestsPerHour <= 0 {
		errors = append(errors, ValidationError{
			Field:   "rateLimiting.requestsPerHour",
			Value:   config.RateLimiting.RequestsPerHour,
			Message: "Requests per hour must be greater than 0",
		})
	}
	
	if config.RateLimiting.RequestsPerMinute > config.RateLimiting.RequestsPerHour {
		errors = append(errors, ValidationError{
			Field:   "rateLimiting",
			Value:   nil,
			Message: "Requests per minute cannot exceed requests per hour",
		})
	}
	
	// Validate model type
	if config.ModelType != "" && config.ModelType != "traditional" && config.ModelType != "openai" {
		errors = append(errors, ValidationError{
			Field:   "modelType",
			Value:   config.ModelType,
			Message: "Model type must be 'traditional' or 'openai'",
		})
	}
	
	// Validate external path
	if config.ExternalPath != "" {
		if !strings.HasPrefix(config.ExternalPath, "/") {
			errors = append(errors, ValidationError{
				Field:   "externalPath",
				Value:   config.ExternalPath,
				Message: "External path must start with '/'",
			})
		}
	}
	
	// Validate public hostname
	if config.PublicHostname != "" {
		// Basic hostname validation
		if strings.Contains(config.PublicHostname, "://") {
			errors = append(errors, ValidationError{
				Field:   "publicHostname",
				Value:   config.PublicHostname,
				Message: "Public hostname should not include protocol (http/https)",
			})
		}
		if strings.Contains(config.PublicHostname, "/") {
			errors = append(errors, ValidationError{
				Field:   "publicHostname",
				Value:   config.PublicHostname,
				Message: "Public hostname should not include path",
			})
		}
	}
	
	// Validate authentication configuration
	if !config.Authentication.RequireAPIKey {
		errors = append(errors, ValidationError{
			Field:   "authentication.requireApiKey",
			Value:   config.Authentication.RequireAPIKey,
			Message: "API key authentication is required",
		})
	}
	
	return errors
}

// ValidateUpdateRequest validates an update request
func (v *PublishingValidator) ValidateUpdateRequest(namespace, modelName string, config PublishConfig, currentModel *PublishedModel) []ValidationError {
	var errors []ValidationError
	
	// Validate tenant ID
	if config.TenantID == "" {
		errors = append(errors, ValidationError{
			Field:   "tenantId",
			Value:   config.TenantID,
			Message: "Tenant ID is required",
		})
	}
	
	// Validate model type (should not change)
	if config.ModelType != "" && config.ModelType != currentModel.ModelType {
		errors = append(errors, ValidationError{
			Field:   "modelType",
			Value:   config.ModelType,
			Message: "Model type cannot be changed after publishing",
		})
	}
	
	// Validate rate limiting configuration
	if config.RateLimiting.RequestsPerMinute <= 0 {
		errors = append(errors, ValidationError{
			Field:   "rateLimiting.requestsPerMinute",
			Value:   config.RateLimiting.RequestsPerMinute,
			Message: "Requests per minute must be greater than 0",
		})
	}
	
	if config.RateLimiting.RequestsPerHour <= 0 {
		errors = append(errors, ValidationError{
			Field:   "rateLimiting.requestsPerHour",
			Value:   config.RateLimiting.RequestsPerHour,
			Message: "Requests per hour must be greater than 0",
		})
	}
	
	if config.RateLimiting.RequestsPerMinute > config.RateLimiting.RequestsPerHour {
		errors = append(errors, ValidationError{
			Field:   "rateLimiting",
			Value:   nil,
			Message: "Requests per minute cannot exceed requests per hour",
		})
	}
	
	// Validate external path
	if config.ExternalPath != "" {
		if !strings.HasPrefix(config.ExternalPath, "/") {
			errors = append(errors, ValidationError{
				Field:   "externalPath",
				Value:   config.ExternalPath,
				Message: "External path must start with '/'",
			})
		}
	}
	
	// Validate public hostname
	if config.PublicHostname != "" {
		// Basic hostname validation
		if strings.Contains(config.PublicHostname, "://") {
			errors = append(errors, ValidationError{
				Field:   "publicHostname",
				Value:   config.PublicHostname,
				Message: "Public hostname should not include protocol (http/https)",
			})
		}
		if strings.Contains(config.PublicHostname, "/") {
			errors = append(errors, ValidationError{
				Field:   "publicHostname",
				Value:   config.PublicHostname,
				Message: "Public hostname should not include path",
			})
		}
	}
	
	// Validate authentication configuration
	if !config.Authentication.RequireAPIKey {
		errors = append(errors, ValidationError{
			Field:   "authentication.requireApiKey",
			Value:   config.Authentication.RequireAPIKey,
			Message: "API key authentication is required",
		})
	}
	
	return errors
}

// RecoveryHandler handles recovery from publishing failures
type RecoveryHandler struct {
	service *PublishingService
}

// NewRecoveryHandler creates a new recovery handler
func NewRecoveryHandler(service *PublishingService) *RecoveryHandler {
	return &RecoveryHandler{
		service: service,
	}
}

// RecoverFromFailure attempts to recover from a publishing failure
func (r *RecoveryHandler) RecoverFromFailure(namespace, modelName string, err error) error {
	log.Printf("Attempting recovery for model %s/%s after error: %v", namespace, modelName, err)
	
	// Check if model is partially published
	isPublished := r.service.isModelPublished(namespace, modelName)
	
	if isPublished {
		log.Printf("Model %s/%s appears to be partially published, attempting cleanup", namespace, modelName)
		
		// Perform cleanup
		r.service.cleanupAPIKey(namespace, modelName)
		r.service.cleanupGatewayConfiguration(namespace, modelName)
		r.service.cleanupRateLimitingPolicy(namespace, modelName)
		r.service.cleanupPublishedModelMetadata(namespace, modelName)
		
		log.Printf("Cleanup completed for model %s/%s", namespace, modelName)
	}
	
	return nil
}

// ErrorReporter handles error reporting and logging
type ErrorReporter struct {
	service *PublishingService
}

// NewErrorReporter creates a new error reporter
func NewErrorReporter(service *PublishingService) *ErrorReporter {
	return &ErrorReporter{
		service: service,
	}
}

// ReportError reports an error with context
func (r *ErrorReporter) ReportError(user *User, namespace, modelName, operation string, err error) {
	// Log the error
	log.Printf("Publishing error - User: %s, Model: %s/%s, Operation: %s, Error: %v", 
		user.Name, namespace, modelName, operation, err)
	
	// Create error log entry
	errorEntry := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"user":      user.Name,
		"tenant":    user.Tenant,
		"operation": operation,
		"model":     modelName,
		"namespace": namespace,
		"error":     err.Error(),
		"level":     "error",
	}
	
	// Store error in audit log
	errorLogName := fmt.Sprintf("publishing-errors-%s", time.Now().Format("2006-01-02"))
	
	// Try to get existing error log for today
	existingLog, logErr := r.service.k8sClient.GetConfigMap(namespace, errorLogName)
	if logErr != nil {
		// Create new error log
		errorData := map[string]interface{}{
			"entries": []interface{}{errorEntry},
		}
		r.service.k8sClient.CreateConfigMap(namespace, errorLogName, errorData)
	} else {
		// Append to existing error log
		if entries, ok := existingLog["entries"].([]interface{}); ok {
			entries = append(entries, errorEntry)
			existingLog["entries"] = entries
			r.service.k8sClient.UpdateConfigMap(namespace, errorLogName, existingLog)
		}
	}
}