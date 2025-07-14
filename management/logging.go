package main

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ResponseWriter wrapper to capture response body
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// RequestResponseLogger creates a middleware that logs detailed request and response information
func RequestResponseLogger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Basic request info (always logged)
		return fmt.Sprintf("[%s] %s \"%s %s\" %d %v \"%s\" %s\n",
			param.TimeStamp.Format("2006/01/02 15:04:05"),
			param.ClientIP,
			param.Method,
			param.Path,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
	})
}

// DetailedRequestResponseLogger creates a middleware that logs full request and response details
func DetailedRequestResponseLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate request ID for tracing
		requestID := uuid.New().String()[:8]
		c.Set("request_id", requestID)
		
		start := time.Now()
		
		// Log request details
		logRequestDetails(c, requestID)
		
		// Create response writer wrapper to capture response body
		writer := &responseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBufferString(""),
		}
		c.Writer = writer
		
		// Process the request
		c.Next()
		
		// Log response details
		logResponseDetails(c, writer, requestID, start)
	}
}

func logRequestDetails(c *gin.Context, requestID string) {
	// Skip logging for health checks and static files to reduce noise
	if shouldSkipLogging(c.Request.URL.Path) {
		return
	}
	
	log.Printf("🔍 [REQ-%s] ==> %s %s", requestID, c.Request.Method, c.Request.URL.Path)
	
	// Log headers (excluding sensitive ones)
	log.Printf("📋 [REQ-%s] Headers:", requestID)
	for name, values := range c.Request.Header {
		if !isSensitiveHeader(name) {
			log.Printf("   %s: %s", name, strings.Join(values, ", "))
		} else {
			log.Printf("   %s: [REDACTED]", name)
		}
	}
	
	// Log query parameters
	if len(c.Request.URL.RawQuery) > 0 {
		log.Printf("🔍 [REQ-%s] Query: %s", requestID, c.Request.URL.RawQuery)
	}
	
	// Log request body for POST/PUT requests
	if c.Request.Method == "POST" || c.Request.Method == "PUT" || c.Request.Method == "PATCH" {
		if c.Request.Body != nil {
			bodyBytes, err := io.ReadAll(c.Request.Body)
			if err == nil {
				// Restore the request body for the handler
				c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				
				// Log body (with size limit and sensitive data redaction)
				bodyStr := string(bodyBytes)
				if len(bodyStr) > 0 {
					log.Printf("📦 [REQ-%s] Body (%d bytes):", requestID, len(bodyStr))
					logSafeBody(bodyStr, requestID, "REQ")
				}
			}
		}
	}
}

func logResponseDetails(c *gin.Context, writer *responseWriter, requestID string, start time.Time) {
	// Skip logging for health checks and static files
	if shouldSkipLogging(c.Request.URL.Path) {
		return
	}
	
	duration := time.Since(start)
	statusCode := c.Writer.Status()
	
	// Determine status emoji
	statusEmoji := "✅"
	if statusCode >= 400 && statusCode < 500 {
		statusEmoji = "⚠️"
	} else if statusCode >= 500 {
		statusEmoji = "❌"
	}
	
	log.Printf("%s [RES-%s] <== %d %s (%v)", statusEmoji, requestID, statusCode, http.StatusText(statusCode), duration)
	
	// Log response headers (excluding sensitive ones)
	log.Printf("📋 [RES-%s] Headers:", requestID)
	for name, values := range c.Writer.Header() {
		if !isSensitiveHeader(name) {
			log.Printf("   %s: %s", name, strings.Join(values, ", "))
		} else {
			log.Printf("   %s: [REDACTED]", name)
		}
	}
	
	// Log response body
	responseBody := writer.body.String()
	if len(responseBody) > 0 {
		log.Printf("📦 [RES-%s] Body (%d bytes):", requestID, len(responseBody))
		logSafeBody(responseBody, requestID, "RES")
	}
	
	log.Printf("⏱️  [REQ-%s] Total Duration: %v", requestID, duration)
	log.Printf("🔚 [REQ-%s] Request Complete\n", requestID)
}

func logSafeBody(body, requestID, prefix string) {
	// Limit body size for logging (max 1000 characters)
	maxLogSize := 1000
	if len(body) > maxLogSize {
		body = body[:maxLogSize] + "... [TRUNCATED]"
	}
	
	// Redact sensitive data patterns
	body = redactSensitiveData(body)
	
	// Pretty print JSON if possible
	if strings.Contains(body, "{") || strings.Contains(body, "[") {
		log.Printf("   %s", prettyPrintJSON(body))
	} else {
		log.Printf("   %s", body)
	}
}

func redactSensitiveData(body string) string {
	// Redact common sensitive fields
	sensitivePatterns := []struct {
		pattern string
		replacement string
	}{
		{`"password":"[^"]*"`, `"password":"[REDACTED]"`},
		{`"token":"[^"]*"`, `"token":"[REDACTED]"`},
		{`"secret":"[^"]*"`, `"secret":"[REDACTED]"`},
		{`"key":"[^"]*"`, `"key":"[REDACTED]"`},
		{`Bearer [A-Za-z0-9\-\._~\+\/]+=*`, `Bearer [REDACTED]`},
	}
	
	result := body
	for _, pattern := range sensitivePatterns {
		// Simple string replacement for basic redaction
		if strings.Contains(strings.ToLower(result), strings.ToLower(pattern.pattern[:10])) {
			// More sophisticated regex replacement would go here
			// For now, doing basic replacements
			if strings.Contains(pattern.pattern, "password") {
				result = strings.ReplaceAll(result, `"password":"`, `"password":"[REDACTED]","temp":"`)
				result = strings.ReplaceAll(result, `","temp":"`, `"`)
			}
			if strings.Contains(pattern.pattern, "token") && strings.Contains(result, `"token":"`) {
				result = strings.ReplaceAll(result, `"token":"`, `"token":"[REDACTED]","temp":"`)
				result = strings.ReplaceAll(result, `","temp":"`, `"`)
			}
		}
	}
	
	return result
}

func prettyPrintJSON(jsonStr string) string {
	// Simple JSON formatting for logging
	// Replace commas and braces with newlines for better readability
	formatted := strings.ReplaceAll(jsonStr, ",", ",\n     ")
	formatted = strings.ReplaceAll(formatted, "{", "{\n     ")
	formatted = strings.ReplaceAll(formatted, "}", "\n   }")
	formatted = strings.ReplaceAll(formatted, "[", "[\n     ")
	formatted = strings.ReplaceAll(formatted, "]", "\n   ]")
	return formatted
}

func shouldSkipLogging(path string) bool {
	// Skip logging for paths that generate too much noise
	skipPaths := []string{
		"/health",
		"/favicon.ico",
		"/static/",
		"/manifest.json",
	}
	
	for _, skipPath := range skipPaths {
		if strings.Contains(path, skipPath) {
			return true
		}
	}
	
	return false
}

func isSensitiveHeader(headerName string) bool {
	// Headers that should be redacted in logs
	sensitiveHeaders := []string{
		"authorization",
		"cookie",
		"set-cookie",
		"x-api-key",
		"x-auth-token",
		"x-access-token",
	}
	
	headerLower := strings.ToLower(headerName)
	for _, sensitive := range sensitiveHeaders {
		if headerLower == sensitive {
			return true
		}
	}
	
	return false
}

// RequestIDMiddleware adds a request ID to context for tracking
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()[:8]
		}
		
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// LogLevel represents logging verbosity
type LogLevel int

const (
	LogLevelBasic LogLevel = iota
	LogLevelDetailed
	LogLevelDebug
)

// GetLogLevel returns the current log level based on environment
func GetLogLevel() LogLevel {
	env := getEnv("LOG_LEVEL", "basic")
	switch strings.ToLower(env) {
	case "detailed":
		return LogLevelDetailed
	case "debug":
		return LogLevelDebug
	default:
		return LogLevelBasic
	}
}

// ConfigureLogging sets up logging based on the environment
func ConfigureLogging() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	
	logLevel := GetLogLevel()
	switch logLevel {
	case LogLevelDebug:
		log.Println("🔧 Log level: DEBUG (very verbose)")
	case LogLevelDetailed:
		log.Println("🔧 Log level: DETAILED (request/response logging)")
	default:
		log.Println("🔧 Log level: BASIC (standard logging)")
	}
}