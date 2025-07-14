package main

import (
	"time"
)

// User represents an authenticated user
type User struct {
	Tenant   string `json:"tenant"`
	Name     string `json:"name,omitempty"`
	Subject  string `json:"sub,omitempty"`
	Issuer   string `json:"iss,omitempty"`
	Audience string `json:"aud,omitempty"`
	IsAdmin  bool   `json:"isAdmin"`
	ExpiresAt int64  `json:"exp,omitempty"`
}

// LoginRequest represents admin login request
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents login response
type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// ModelRequest represents model creation/update request
type ModelRequest struct {
	Name        string `json:"name" binding:"required"`
	Framework   string `json:"framework" binding:"required"`
	StorageUri  string `json:"storageUri" binding:"required"`
	MinReplicas *int   `json:"minReplicas,omitempty"`
	MaxReplicas *int   `json:"maxReplicas,omitempty"`
	ScaleTarget *int   `json:"scaleTarget,omitempty"`
	ScaleMetric string `json:"scaleMetric,omitempty"`
	Namespace   string `json:"namespace,omitempty"`
}

// ModelResponse represents model operation response
type ModelResponse struct {
	Message   string      `json:"message"`
	Name      string      `json:"name"`
	Namespace string      `json:"namespace"`
	Config    ModelConfig `json:"config"`
}

// ModelConfig represents model configuration
type ModelConfig struct {
	Framework   string `json:"framework"`
	StorageUri  string `json:"storageUri"`
	MinReplicas int    `json:"minReplicas"`
	MaxReplicas int    `json:"maxReplicas"`
	ScaleTarget int    `json:"scaleTarget"`
	ScaleMetric string `json:"scaleMetric"`
}

// ModelCondition represents a model condition
type ModelCondition struct {
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	Reason             string    `json:"reason,omitempty"`
	Message            string    `json:"message,omitempty"`
	LastTransitionTime time.Time `json:"lastTransitionTime,omitempty"`
}

// ModelComponent represents a model component status
type ModelComponent struct {
	Ready   bool   `json:"ready"`
	URL     string `json:"url,omitempty"`
	Traffic int    `json:"traffic,omitempty"`
}

// ModelReplicas represents replica information
type ModelReplicas struct {
	Desired int `json:"desired"`
	Ready   int `json:"ready"`
	Total   int `json:"total"`
}

// ModelStatusDetails represents detailed model status
type ModelStatusDetails struct {
	Ready                  bool                       `json:"ready"`
	Phase                  string                     `json:"phase"`
	URL                    string                     `json:"url,omitempty"`
	ObservedGeneration     int64                      `json:"observedGeneration,omitempty"`
	Conditions             []ModelCondition           `json:"conditions"`
	Components             map[string]*ModelComponent `json:"components"`
	ModelCopies            interface{}                `json:"modelCopies,omitempty"`
	Replicas               ModelReplicas              `json:"replicas"`
	Traffic                interface{}                `json:"traffic,omitempty"`
	Address                interface{}                `json:"address,omitempty"`
	LatestCreatedRevision  string                     `json:"latestCreatedRevision,omitempty"`
	LatestReadyRevision    string                     `json:"latestReadyRevision,omitempty"`
	Error                  string                     `json:"error,omitempty"`
}

// ModelInfo represents model information
type ModelInfo struct {
	Name          string                 `json:"name"`
	Namespace     string                 `json:"namespace"`
	Status        string                 `json:"status"`
	Ready         bool                   `json:"ready"`
	URL           string                 `json:"url,omitempty"`
	Predictor     interface{}            `json:"predictor"`
	CreatedAt     time.Time              `json:"createdAt"`
	StatusDetails ModelStatusDetails     `json:"statusDetails"`
	Spec          interface{}            `json:"spec,omitempty"`
	FullStatus    interface{}            `json:"fullStatus,omitempty"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// ModelListResponse represents model list response
type ModelListResponse struct {
	Models []ModelInfo `json:"models"`
}

// PredictRequest represents prediction request
type PredictRequest struct {
	InputData          interface{}         `json:"inputData" binding:"required"`
	ConnectionSettings *ConnectionSettings `json:"connectionSettings,omitempty"`
}

// ConnectionSettings represents custom connection settings
type ConnectionSettings struct {
	UseCustom bool            `json:"useCustom"`
	Protocol  string          `json:"protocol,omitempty"`
	Host      string          `json:"host,omitempty"`
	Port      string          `json:"port,omitempty"`
	Path      string          `json:"path,omitempty"`
	Headers   []HeaderSetting `json:"headers,omitempty"`
	Namespace string          `json:"namespace,omitempty"`
}

// HeaderSetting represents a header key-value pair
type HeaderSetting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// LogsResponse represents logs response
type LogsResponse struct {
	Logs []string `json:"logs"`
}

// TenantResponse represents tenant information response
type TenantResponse struct {
	Tenant    string `json:"tenant"`
	User      string `json:"user"`
	Issuer    string `json:"issuer,omitempty"`
	Audience  string `json:"audience,omitempty"`
	ExpiresAt string `json:"expiresAt,omitempty"`
}

// FrameworksResponse represents frameworks response
type FrameworksResponse struct {
	Frameworks []Framework `json:"frameworks"`
}

// HealthResponse represents health check response
type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

// ErrorResponse represents error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// AdminSystemResponse represents admin system response
type AdminSystemResponse struct {
	Nodes       []NodeInfo       `json:"nodes"`
	Namespaces  []NamespaceInfo  `json:"namespaces"`
	Deployments []DeploymentInfo `json:"deployments"`
}

// NodeInfo represents node information
type NodeInfo struct {
	Name        string                 `json:"name"`
	Status      string                 `json:"status"`
	Version     string                 `json:"version"`
	Capacity    map[string]interface{} `json:"capacity"`
	Allocatable map[string]interface{} `json:"allocatable"`
}

// NamespaceInfo represents namespace information
type NamespaceInfo struct {
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created"`
}

// DeploymentInfo represents deployment information
type DeploymentInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     int32  `json:"ready"`
	Replicas  int32  `json:"replicas"`
	Available int32  `json:"available"`
}

// AdminTenantsResponse represents admin tenants response
type AdminTenantsResponse struct {
	Tenants []NamespaceInfo `json:"tenants"`
}

// AdminResourcesResponse represents admin resources response
type AdminResourcesResponse struct {
	Pods      []PodInfo      `json:"pods"`
	Services  []ServiceInfo  `json:"services"`
	Ingresses []IngressInfo  `json:"ingresses"`
}

// PodInfo represents pod information
type PodInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Status    string    `json:"status"`
	Ready     bool      `json:"ready"`
	Restarts  int32     `json:"restarts"`
	CreatedAt time.Time `json:"created"`
}

// ServiceInfo represents service information
type ServiceInfo struct {
	Name      string                   `json:"name"`
	Namespace string                   `json:"namespace"`
	Type      string                   `json:"type"`
	ClusterIP string                   `json:"clusterIP"`
	Ports     []map[string]interface{} `json:"ports"`
}

// IngressInfo represents ingress information
type IngressInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Hosts     []string  `json:"hosts"`
	CreatedAt time.Time `json:"created"`
}

// KubectlRequest represents kubectl command request
type KubectlRequest struct {
	Command string `json:"command" binding:"required"`
}

// KubectlResponse represents kubectl command response
type KubectlResponse struct {
	Result  string `json:"result"`
	Command string `json:"command"`
}