package main

import (
	"fmt"
	"os/exec"
	"strings"

	"gopkg.in/yaml.v2"
)

// ExecuteCommand executes a shell command and returns the output
func ExecuteCommand(command string) (string, error) {
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return "", fmt.Errorf("empty command")
	}
	
	cmd := exec.Command(parts[0], parts[1:]...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("command failed: %w", err)
	}
	
	return string(output), nil
}

// ToYAML converts a map to YAML string
func ToYAML(data map[string]interface{}) (string, error) {
	yamlBytes, err := yaml.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal to YAML: %w", err)
	}
	return string(yamlBytes), nil
}

// ConvertToModelInfo converts a Kubernetes object to ModelInfo
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
			modelInfo.CreatedAt = parseTime(creationTimestamp)
		}
		modelInfo.Metadata = metadata
	}
	
	// Extract spec
	if spec, ok := obj["spec"].(map[string]interface{}); ok {
		modelInfo.Spec = spec
		if predictor, ok := spec["predictor"].(map[string]interface{}); ok {
			modelInfo.Predictor = predictor
		}
	}
	
	// Extract status
	if status, ok := obj["status"].(map[string]interface{}); ok {
		modelInfo.FullStatus = status
		
		// Parse status details
		statusDetails := ModelStatusDetails{
			Components: make(map[string]*ModelComponent),
		}
		
		// Check ready condition
		if conditions, ok := status["conditions"].([]interface{}); ok {
			for _, condition := range conditions {
				if cond, ok := condition.(map[string]interface{}); ok {
					condType, _ := cond["type"].(string)
					condStatus, _ := cond["status"].(string)
					
					if condType == "Ready" {
						modelInfo.Ready = condStatus == "True"
						statusDetails.Ready = modelInfo.Ready
					}
					
					// Convert condition
					modelCondition := ModelCondition{
						Type:   condType,
						Status: condStatus,
					}
					if reason, ok := cond["reason"].(string); ok {
						modelCondition.Reason = reason
					}
					if message, ok := cond["message"].(string); ok {
						modelCondition.Message = message
					}
					if lastTransitionTime, ok := cond["lastTransitionTime"].(string); ok {
						modelCondition.LastTransitionTime = parseTime(lastTransitionTime)
					}
					
					statusDetails.Conditions = append(statusDetails.Conditions, modelCondition)
				}
			}
		}
		
		// Extract URL
		if url, ok := status["url"].(string); ok {
			modelInfo.URL = url
			statusDetails.URL = url
		}
		
		// Extract phase
		if phase, ok := status["phase"].(string); ok {
			statusDetails.Phase = phase
		}
		
		// Extract observed generation
		if observedGeneration, ok := status["observedGeneration"].(float64); ok {
			statusDetails.ObservedGeneration = int64(observedGeneration)
		}
		
		// Extract components
		if components, ok := status["components"].(map[string]interface{}); ok {
			for name, component := range components {
				if comp, ok := component.(map[string]interface{}); ok {
					modelComponent := &ModelComponent{}
					if ready, ok := comp["ready"].(bool); ok {
						modelComponent.Ready = ready
					}
					if url, ok := comp["url"].(string); ok {
						modelComponent.URL = url
					}
					if traffic, ok := comp["traffic"].(float64); ok {
						modelComponent.Traffic = int(traffic)
					}
					statusDetails.Components[name] = modelComponent
				}
			}
		}
		
		// Extract replicas information
		if address, ok := status["address"].(map[string]interface{}); ok {
			if url, ok := address["url"].(string); ok && modelInfo.URL == "" {
				modelInfo.URL = url
				statusDetails.URL = url
			}
		}
		
		// Set model status
		if modelInfo.Ready {
			modelInfo.Status = "Ready"
		} else if statusDetails.Phase != "" {
			modelInfo.Status = statusDetails.Phase
		} else {
			modelInfo.Status = "Not Ready"
		}
		
		modelInfo.StatusDetails = statusDetails
	}
	
	return modelInfo
}

// GenerateModelYAML generates YAML configuration for a model
func GenerateModelYAML(modelName, namespace string, config ModelConfig) (map[string]interface{}, error) {
	// Create InferenceService specification
	inferenceService := map[string]interface{}{
		"apiVersion": "serving.kserve.io/v1beta1",
		"kind":       "InferenceService",
		"metadata": map[string]interface{}{
			"name":      modelName,
			"namespace": namespace,
		},
		"spec": map[string]interface{}{
			"predictor": map[string]interface{}{
				config.Framework: map[string]interface{}{
					"storageUri": config.StorageUri,
				},
				"minReplicas": config.MinReplicas,
				"maxReplicas": config.MaxReplicas,
				"scaleTarget": config.ScaleTarget,
				"scaleMetric": config.ScaleMetric,
			},
		},
	}

	return inferenceService, nil
}

