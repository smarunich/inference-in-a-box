package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// ExecuteCommand executes a system command and returns the output
func ExecuteCommand(command string) (string, error) {
	cmd := exec.Command("sh", "-c", command)
	output, err := cmd.CombinedOutput()
	
	if err != nil {
		return "", fmt.Errorf("command failed: %s, output: %s", err.Error(), string(output))
	}
	
	return strings.TrimSpace(string(output)), nil
}

// ToYAML converts a map to YAML string
func ToYAML(data interface{}) (string, error) {
	yamlData, err := yaml.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal to YAML: %w", err)
	}
	
	return string(yamlData), nil
}

// GenerateModelYAML generates InferenceService YAML
func GenerateModelYAML(modelName, tenant string, config ModelConfig) (map[string]interface{}, error) {
	// Set defaults
	minReplicas := config.MinReplicas
	if minReplicas == 0 {
		minReplicas = 1
	}
	
	maxReplicas := config.MaxReplicas
	if maxReplicas == 0 {
		maxReplicas = 3
	}
	
	scaleTarget := config.ScaleTarget
	if scaleTarget == 0 {
		scaleTarget = 60
	}
	
	scaleMetric := config.ScaleMetric
	if scaleMetric == "" {
		scaleMetric = "concurrency"
	}
	
	// Build the predictor configuration
	predictor := map[string]interface{}{
		"minReplicas": minReplicas,
		"maxReplicas": maxReplicas,
		"scaleTarget": scaleTarget,
		"scaleMetric": scaleMetric,
	}
	
	// Add framework-specific configuration
	predictor[config.Framework] = map[string]interface{}{
		"storageUri": config.StorageUri,
	}
	
	// Create the InferenceService specification
	modelSpec := map[string]interface{}{
		"apiVersion": "serving.kserve.io/v1beta1",
		"kind":       "InferenceService",
		"metadata": map[string]interface{}{
			"name":      modelName,
			"namespace": tenant,
		},
		"spec": map[string]interface{}{
			"predictor": predictor,
		},
	}
	
	return modelSpec, nil
}

// ParseModelStatus parses model status from Kubernetes object
func ParseModelStatus(obj map[string]interface{}) ModelStatusDetails {
	status := ModelStatusDetails{
		Ready:      false,
		Phase:      "Unknown",
		Conditions: []ModelCondition{},
		Components: make(map[string]*ModelComponent),
		Replicas:   ModelReplicas{},
	}
	
	// Extract status from the object
	statusObj, ok := obj["status"].(map[string]interface{})
	if !ok {
		return status
	}
	
	// Extract conditions
	if conditionsRaw, ok := statusObj["conditions"].([]interface{}); ok {
		for _, conditionRaw := range conditionsRaw {
			if condition, ok := conditionRaw.(map[string]interface{}); ok {
				modelCondition := ModelCondition{}
				
				if condType, ok := condition["type"].(string); ok {
					modelCondition.Type = condType
				}
				if condStatus, ok := condition["status"].(string); ok {
					modelCondition.Status = condStatus
				}
				if reason, ok := condition["reason"].(string); ok {
					modelCondition.Reason = reason
				}
				if message, ok := condition["message"].(string); ok {
					modelCondition.Message = message
				}
				if lastTransition, ok := condition["lastTransitionTime"].(string); ok {
					if t, err := time.Parse(time.RFC3339, lastTransition); err == nil {
						modelCondition.LastTransitionTime = t
					}
				}
				
				status.Conditions = append(status.Conditions, modelCondition)
			}
		}
	}
	
	// Determine readiness
	ready := false
	phase := "Unknown"
	
	// Look for Ready condition
	for _, condition := range status.Conditions {
		if condition.Type == "Ready" {
			ready = condition.Status == "True"
			phase = condition.Status
			break
		}
	}
	
	// Fallback: check if any condition is True
	if !ready {
		for _, condition := range status.Conditions {
			if condition.Status == "True" {
				ready = true
				phase = "True"
				break
			}
		}
	}
	
	// Additional check: if model has a URL, it's likely ready
	if url, ok := statusObj["url"].(string); ok && url != "" {
		status.URL = url
		if !ready {
			ready = true
			phase = "True"
		}
	}
	
	status.Ready = ready
	status.Phase = phase
	
	// Extract observed generation
	if gen, ok := statusObj["observedGeneration"].(float64); ok {
		status.ObservedGeneration = int64(gen)
	}
	
	// Extract component statuses
	if components, ok := statusObj["components"].(map[string]interface{}); ok {
		// Predictor component
		if predictor, ok := components["predictor"].(map[string]interface{}); ok {
			component := &ModelComponent{}
			
			// Check for predictor ready condition
			for _, condition := range status.Conditions {
				if condition.Type == "PredictorReady" {
					component.Ready = condition.Status == "True"
					break
				}
			}
			
			if url, ok := predictor["url"].(string); ok {
				component.URL = url
			}
			if traffic, ok := predictor["traffic"].(float64); ok {
				component.Traffic = int(traffic)
			}
			
			status.Components["predictor"] = component
		}
		
		// Transformer component
		if transformer, ok := components["transformer"].(map[string]interface{}); ok {
			component := &ModelComponent{}
			
			for _, condition := range status.Conditions {
				if condition.Type == "TransformerReady" {
					component.Ready = condition.Status == "True"
					break
				}
			}
			
			if url, ok := transformer["url"].(string); ok {
				component.URL = url
			}
			if traffic, ok := transformer["traffic"].(float64); ok {
				component.Traffic = int(traffic)
			}
			
			status.Components["transformer"] = component
		}
		
		// Explainer component
		if explainer, ok := components["explainer"].(map[string]interface{}); ok {
			component := &ModelComponent{}
			
			for _, condition := range status.Conditions {
				if condition.Type == "ExplainerReady" {
					component.Ready = condition.Status == "True"
					break
				}
			}
			
			if url, ok := explainer["url"].(string); ok {
				component.URL = url
			}
			if traffic, ok := explainer["traffic"].(float64); ok {
				component.Traffic = int(traffic)
			}
			
			status.Components["explainer"] = component
		}
	}
	
	// Extract replica information
	if replicas, ok := statusObj["replicas"].(map[string]interface{}); ok {
		if ready, ok := replicas["ready"].(float64); ok {
			status.Replicas.Ready = int(ready)
		}
		if total, ok := replicas["total"].(float64); ok {
			status.Replicas.Total = int(total)
		}
	}
	
	// Extract spec for desired replicas
	if specObj, ok := obj["spec"].(map[string]interface{}); ok {
		if predictor, ok := specObj["predictor"].(map[string]interface{}); ok {
			if maxReplicas, ok := predictor["maxReplicas"].(float64); ok {
				status.Replicas.Desired = int(maxReplicas)
			}
		}
	}
	
	// Extract other fields
	if modelCopies, ok := statusObj["modelCopies"]; ok {
		status.ModelCopies = modelCopies
	}
	if traffic, ok := statusObj["traffic"]; ok {
		status.Traffic = traffic
	}
	if address, ok := statusObj["address"]; ok {
		status.Address = address
	}
	if revision, ok := statusObj["latestCreatedRevision"].(string); ok {
		status.LatestCreatedRevision = revision
	}
	if revision, ok := statusObj["latestReadyRevision"].(string); ok {
		status.LatestReadyRevision = revision
	}
	
	// Extract error message from failed conditions
	for _, condition := range status.Conditions {
		if condition.Status == "False" && condition.Message != "" {
			status.Error = condition.Message
			break
		}
	}
	
	return status
}

// ConvertToModelInfo converts Kubernetes object to ModelInfo
func ConvertToModelInfo(obj map[string]interface{}) ModelInfo {
	modelInfo := ModelInfo{
		Metadata: make(map[string]interface{}),
	}
	
	// Extract metadata
	if metadata, ok := obj["metadata"].(map[string]interface{}); ok {
		if name, ok := metadata["name"].(string); ok {
			modelInfo.Name = name
		}
		if namespace, ok := metadata["namespace"].(string); ok {
			modelInfo.Namespace = namespace
		}
		if creationTimestamp, ok := metadata["creationTimestamp"].(string); ok {
			if t, err := time.Parse(time.RFC3339, creationTimestamp); err == nil {
				modelInfo.CreatedAt = t
			}
		}
		
		// Extract metadata details
		if labels, ok := metadata["labels"]; ok {
			modelInfo.Metadata["labels"] = labels
		}
		if annotations, ok := metadata["annotations"]; ok {
			modelInfo.Metadata["annotations"] = annotations
		}
		if generation, ok := metadata["generation"].(float64); ok {
			modelInfo.Metadata["generation"] = int64(generation)
		}
		if resourceVersion, ok := metadata["resourceVersion"].(string); ok {
			modelInfo.Metadata["resourceVersion"] = resourceVersion
		}
		if uid, ok := metadata["uid"].(string); ok {
			modelInfo.Metadata["uid"] = uid
		}
	}
	
	// Extract spec
	if spec, ok := obj["spec"]; ok {
		modelInfo.Spec = spec
		if predictor, ok := spec.(map[string]interface{})["predictor"]; ok {
			modelInfo.Predictor = predictor
		}
	}
	
	// Extract status
	if status, ok := obj["status"]; ok {
		modelInfo.FullStatus = status
	}
	
	// Parse detailed status
	statusDetails := ParseModelStatus(obj)
	modelInfo.StatusDetails = statusDetails
	
	// Set top-level fields for backward compatibility
	modelInfo.Status = statusDetails.Phase
	modelInfo.Ready = statusDetails.Ready
	modelInfo.URL = statusDetails.URL
	
	return modelInfo
}

// WriteToTempFile writes content to a temporary file
func WriteToTempFile(content string, prefix string) (string, error) {
	tempFile, err := os.CreateTemp("", prefix)
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer tempFile.Close()
	
	if _, err := tempFile.WriteString(content); err != nil {
		return "", fmt.Errorf("failed to write to temp file: %w", err)
	}
	
	return tempFile.Name(), nil
}

// DeleteTempFile removes a temporary file
func DeleteTempFile(filename string) error {
	if err := os.Remove(filename); err != nil {
		return fmt.Errorf("failed to remove temp file: %w", err)
	}
	return nil
}

// GetStringFromMap safely extracts a string value from a map
func GetStringFromMap(m map[string]interface{}, key string) string {
	if value, ok := m[key].(string); ok {
		return value
	}
	return ""
}

// GetIntFromMap safely extracts an int value from a map
func GetIntFromMap(m map[string]interface{}, key string) int {
	if value, ok := m[key].(float64); ok {
		return int(value)
	}
	return 0
}

// GetBoolFromMap safely extracts a bool value from a map
func GetBoolFromMap(m map[string]interface{}, key string) bool {
	if value, ok := m[key].(bool); ok {
		return value
	}
	return false
}

// IsResourceNotFoundError checks if an error is a "not found" error
func IsResourceNotFoundError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "not found")
}