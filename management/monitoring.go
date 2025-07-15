package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// UsageTracker handles usage statistics collection and reporting
type UsageTracker struct {
	k8sClient *K8sClient
}

// NewUsageTracker creates a new usage tracker
func NewUsageTracker(k8sClient *K8sClient) *UsageTracker {
	return &UsageTracker{
		k8sClient: k8sClient,
	}
}

// TrackAPIRequest tracks an API request for a published model
func (t *UsageTracker) TrackAPIRequest(namespace, modelName, apiKey string, requestData APIRequestData) error {
	// Create usage entry
	usageEntry := map[string]interface{}{
		"timestamp":    time.Now().Format(time.RFC3339),
		"modelName":    modelName,
		"namespace":    namespace,
		"apiKey":       apiKey[:8] + "...", // Only store first 8 chars for security
		"method":       requestData.Method,
		"endpoint":     requestData.Endpoint,
		"statusCode":   requestData.StatusCode,
		"responseTime": requestData.ResponseTime,
		"requestSize":  requestData.RequestSize,
		"responseSize": requestData.ResponseSize,
		"userAgent":    requestData.UserAgent,
		"clientIP":     requestData.ClientIP,
	}
	
	// Add token usage for OpenAI models
	if requestData.TokensUsed > 0 {
		usageEntry["tokensUsed"] = requestData.TokensUsed
		usageEntry["promptTokens"] = requestData.PromptTokens
		usageEntry["completionTokens"] = requestData.CompletionTokens
	}
	
	// Store in daily usage log
	usageLogName := fmt.Sprintf("model-usage-%s-%s", modelName, time.Now().Format("2006-01-02"))
	
	// Try to get existing usage log for today
	existingLog, err := t.k8sClient.GetConfigMap(namespace, usageLogName)
	if err != nil {
		// Create new usage log
		usageData := map[string]interface{}{
			"entries": []interface{}{usageEntry},
			"summary": map[string]interface{}{
				"totalRequests": 1,
				"totalTokens":   requestData.TokensUsed,
				"avgResponseTime": requestData.ResponseTime,
				"errorCount":    0,
			},
		}
		if requestData.StatusCode >= 400 {
			usageData["summary"].(map[string]interface{})["errorCount"] = 1
		}
		return t.k8sClient.CreateConfigMap(namespace, usageLogName, usageData)
	} else {
		// Append to existing usage log and update summary
		if entries, ok := existingLog["entries"].([]interface{}); ok {
			entries = append(entries, usageEntry)
			existingLog["entries"] = entries
			
			// Update summary
			if summary, ok := existingLog["summary"].(map[string]interface{}); ok {
				if totalRequests, ok := summary["totalRequests"].(float64); ok {
					summary["totalRequests"] = totalRequests + 1
				}
				if totalTokens, ok := summary["totalTokens"].(float64); ok {
					summary["totalTokens"] = totalTokens + float64(requestData.TokensUsed)
				}
				if requestData.StatusCode >= 400 {
					if errorCount, ok := summary["errorCount"].(float64); ok {
						summary["errorCount"] = errorCount + 1
					}
				}
				// Update average response time
				if avgResponseTime, ok := summary["avgResponseTime"].(float64); ok {
					newCount := summary["totalRequests"].(float64)
					summary["avgResponseTime"] = (avgResponseTime*(newCount-1) + float64(requestData.ResponseTime)) / newCount
				}
			}
			
			return t.k8sClient.UpdateConfigMap(namespace, usageLogName, existingLog)
		}
	}
	
	return nil
}

// GetUsageStats retrieves usage statistics for a published model
func (t *UsageTracker) GetUsageStats(namespace, modelName string, days int) (*UsageStats, error) {
	stats := &UsageStats{}
	
	// Aggregate stats from the last N days
	for i := 0; i < days; i++ {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		usageLogName := fmt.Sprintf("model-usage-%s-%s", modelName, date)
		
		usageLog, err := t.k8sClient.GetConfigMap(namespace, usageLogName)
		if err != nil {
			continue // Skip days with no data
		}
		
		if summary, ok := usageLog["summary"].(map[string]interface{}); ok {
			if totalRequests, ok := summary["totalRequests"].(float64); ok {
				stats.TotalRequests += int64(totalRequests)
			}
			if totalTokens, ok := summary["totalTokens"].(float64); ok {
				stats.TokensUsed += int64(totalTokens)
			}
			if i == 0 { // Today's requests
				stats.RequestsToday = int64(summary["totalRequests"].(float64))
			}
		}
		
		// Get last access time from entries
		if entries, ok := usageLog["entries"].([]interface{}); ok && len(entries) > 0 {
			if lastEntry, ok := entries[len(entries)-1].(map[string]interface{}); ok {
				if timestamp, ok := lastEntry["timestamp"].(string); ok {
					if t, err := time.Parse(time.RFC3339, timestamp); err == nil {
						if stats.LastAccessTime.IsZero() || t.After(stats.LastAccessTime) {
							stats.LastAccessTime = t
						}
					}
				}
			}
		}
	}
	
	return stats, nil
}

// GetDetailedUsageReport generates a detailed usage report
func (t *UsageTracker) GetDetailedUsageReport(namespace, modelName string, startDate, endDate time.Time) (*DetailedUsageReport, error) {
	report := &DetailedUsageReport{
		ModelName: modelName,
		Namespace: namespace,
		StartDate: startDate,
		EndDate:   endDate,
		DailyStats: make([]DailyUsageStats, 0),
	}
	
	// Iterate through each day in the range
	for d := startDate; d.Before(endDate) || d.Equal(endDate); d = d.AddDate(0, 0, 1) {
		date := d.Format("2006-01-02")
		usageLogName := fmt.Sprintf("model-usage-%s-%s", modelName, date)
		
		usageLog, err := t.k8sClient.GetConfigMap(namespace, usageLogName)
		if err != nil {
			continue // Skip days with no data
		}
		
		dailyStats := DailyUsageStats{
			Date: d,
		}
		
		if summary, ok := usageLog["summary"].(map[string]interface{}); ok {
			if totalRequests, ok := summary["totalRequests"].(float64); ok {
				dailyStats.TotalRequests = int64(totalRequests)
				report.TotalRequests += dailyStats.TotalRequests
			}
			if totalTokens, ok := summary["totalTokens"].(float64); ok {
				dailyStats.TokensUsed = int64(totalTokens)
				report.TotalTokens += dailyStats.TokensUsed
			}
			if avgResponseTime, ok := summary["avgResponseTime"].(float64); ok {
				dailyStats.AvgResponseTime = avgResponseTime
			}
			if errorCount, ok := summary["errorCount"].(float64); ok {
				dailyStats.ErrorCount = int64(errorCount)
				report.TotalErrors += dailyStats.ErrorCount
			}
		}
		
		// Analyze request patterns
		if entries, ok := usageLog["entries"].([]interface{}); ok {
			dailyStats.RequestPatterns = t.analyzeRequestPatterns(entries)
		}
		
		report.DailyStats = append(report.DailyStats, dailyStats)
	}
	
	// Calculate averages
	if len(report.DailyStats) > 0 {
		report.AvgRequestsPerDay = float64(report.TotalRequests) / float64(len(report.DailyStats))
		report.AvgTokensPerDay = float64(report.TotalTokens) / float64(len(report.DailyStats))
	}
	
	return report, nil
}

// analyzeRequestPatterns analyzes request patterns from usage entries
func (t *UsageTracker) analyzeRequestPatterns(entries []interface{}) RequestPatterns {
	patterns := RequestPatterns{
		HourlyDistribution: make(map[int]int64),
		StatusCodes:        make(map[int]int64),
		UserAgents:         make(map[string]int64),
		Endpoints:          make(map[string]int64),
	}
	
	for _, entry := range entries {
		if entryMap, ok := entry.(map[string]interface{}); ok {
			// Analyze hourly distribution
			if timestamp, ok := entryMap["timestamp"].(string); ok {
				if t, err := time.Parse(time.RFC3339, timestamp); err == nil {
					hour := t.Hour()
					patterns.HourlyDistribution[hour]++
				}
			}
			
			// Analyze status codes
			if statusCode, ok := entryMap["statusCode"].(float64); ok {
				patterns.StatusCodes[int(statusCode)]++
			}
			
			// Analyze user agents
			if userAgent, ok := entryMap["userAgent"].(string); ok {
				patterns.UserAgents[userAgent]++
			}
			
			// Analyze endpoints
			if endpoint, ok := entryMap["endpoint"].(string); ok {
				patterns.Endpoints[endpoint]++
			}
		}
	}
	
	return patterns
}

// AuditLogger handles audit logging for publishing operations
type AuditLogger struct {
	k8sClient *K8sClient
}

// NewAuditLogger creates a new audit logger
func NewAuditLogger(k8sClient *K8sClient) *AuditLogger {
	return &AuditLogger{
		k8sClient: k8sClient,
	}
}

// LogPublishingEvent logs a publishing-related event
func (a *AuditLogger) LogPublishingEvent(event AuditEvent) error {
	// Create audit entry
	auditEntry := map[string]interface{}{
		"timestamp":   event.Timestamp.Format(time.RFC3339),
		"eventType":   event.EventType,
		"user":        event.User,
		"tenant":      event.Tenant,
		"modelName":   event.ModelName,
		"namespace":   event.Namespace,
		"action":      event.Action,
		"result":      event.Result,
		"details":     event.Details,
		"userAgent":   event.UserAgent,
		"clientIP":    event.ClientIP,
		"sessionID":   event.SessionID,
	}
	
	// Store in daily audit log
	auditLogName := fmt.Sprintf("publishing-audit-%s", event.Timestamp.Format("2006-01-02"))
	
	// Try to get existing audit log for today
	existingLog, err := a.k8sClient.GetConfigMap(event.Namespace, auditLogName)
	if err != nil {
		// Create new audit log
		auditData := map[string]interface{}{
			"entries": []interface{}{auditEntry},
		}
		return a.k8sClient.CreateConfigMap(event.Namespace, auditLogName, auditData)
	} else {
		// Append to existing audit log
		if entries, ok := existingLog["entries"].([]interface{}); ok {
			entries = append(entries, auditEntry)
			existingLog["entries"] = entries
			return a.k8sClient.UpdateConfigMap(event.Namespace, auditLogName, existingLog)
		}
	}
	
	return nil
}

// GetAuditLogs retrieves audit logs for a date range
func (a *AuditLogger) GetAuditLogs(namespace string, startDate, endDate time.Time) ([]AuditEvent, error) {
	var events []AuditEvent
	
	// Iterate through each day in the range
	for d := startDate; d.Before(endDate) || d.Equal(endDate); d = d.AddDate(0, 0, 1) {
		auditLogName := fmt.Sprintf("publishing-audit-%s", d.Format("2006-01-02"))
		
		auditLog, err := a.k8sClient.GetConfigMap(namespace, auditLogName)
		if err != nil {
			continue // Skip days with no data
		}
		
		if entries, ok := auditLog["entries"].([]interface{}); ok {
			for _, entry := range entries {
				if entryMap, ok := entry.(map[string]interface{}); ok {
					event := AuditEvent{}
					
					if timestamp, ok := entryMap["timestamp"].(string); ok {
						if t, err := time.Parse(time.RFC3339, timestamp); err == nil {
							event.Timestamp = t
						}
					}
					if eventType, ok := entryMap["eventType"].(string); ok {
						event.EventType = eventType
					}
					if user, ok := entryMap["user"].(string); ok {
						event.User = user
					}
					if tenant, ok := entryMap["tenant"].(string); ok {
						event.Tenant = tenant
					}
					if modelName, ok := entryMap["modelName"].(string); ok {
						event.ModelName = modelName
					}
					if namespace, ok := entryMap["namespace"].(string); ok {
						event.Namespace = namespace
					}
					if action, ok := entryMap["action"].(string); ok {
						event.Action = action
					}
					if result, ok := entryMap["result"].(string); ok {
						event.Result = result
					}
					if details, ok := entryMap["details"].(string); ok {
						event.Details = details
					}
					
					events = append(events, event)
				}
			}
		}
	}
	
	return events, nil
}

// Data structures for monitoring

// APIRequestData represents data about an API request
type APIRequestData struct {
	Method            string
	Endpoint          string
	StatusCode        int
	ResponseTime      int64 // in milliseconds
	RequestSize       int64
	ResponseSize      int64
	UserAgent         string
	ClientIP          string
	TokensUsed        int64
	PromptTokens      int64
	CompletionTokens  int64
}

// DetailedUsageReport represents a detailed usage report
type DetailedUsageReport struct {
	ModelName         string             `json:"modelName"`
	Namespace         string             `json:"namespace"`
	StartDate         time.Time          `json:"startDate"`
	EndDate           time.Time          `json:"endDate"`
	TotalRequests     int64              `json:"totalRequests"`
	TotalTokens       int64              `json:"totalTokens"`
	TotalErrors       int64              `json:"totalErrors"`
	AvgRequestsPerDay float64            `json:"avgRequestsPerDay"`
	AvgTokensPerDay   float64            `json:"avgTokensPerDay"`
	DailyStats        []DailyUsageStats  `json:"dailyStats"`
}

// DailyUsageStats represents usage statistics for a single day
type DailyUsageStats struct {
	Date            time.Time       `json:"date"`
	TotalRequests   int64           `json:"totalRequests"`
	TokensUsed      int64           `json:"tokensUsed"`
	ErrorCount      int64           `json:"errorCount"`
	AvgResponseTime float64         `json:"avgResponseTime"`
	RequestPatterns RequestPatterns `json:"requestPatterns"`
}

// RequestPatterns represents patterns in API requests
type RequestPatterns struct {
	HourlyDistribution map[int]int64    `json:"hourlyDistribution"`
	StatusCodes        map[int]int64    `json:"statusCodes"`
	UserAgents         map[string]int64 `json:"userAgents"`
	Endpoints          map[string]int64 `json:"endpoints"`
}

// AuditEvent represents an audit event
type AuditEvent struct {
	Timestamp time.Time `json:"timestamp"`
	EventType string    `json:"eventType"`
	User      string    `json:"user"`
	Tenant    string    `json:"tenant"`
	ModelName string    `json:"modelName"`
	Namespace string    `json:"namespace"`
	Action    string    `json:"action"`
	Result    string    `json:"result"`
	Details   string    `json:"details"`
	UserAgent string    `json:"userAgent"`
	ClientIP  string    `json:"clientIP"`
	SessionID string    `json:"sessionID"`
}