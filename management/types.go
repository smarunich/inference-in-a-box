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
	UseCustom  bool            `json:"useCustom"`
	Protocol   string          `json:"protocol,omitempty"`
	Host       string          `json:"host,omitempty"`
	Port       string          `json:"port,omitempty"`
	Path       string          `json:"path,omitempty"`
	Headers    []HeaderSetting `json:"headers,omitempty"`
	Namespace  string          `json:"namespace,omitempty"`
	DNSResolve []DNSResolve    `json:"dnsResolve,omitempty"`
}

// HeaderSetting represents a header key-value pair
type HeaderSetting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// DNSResolve represents a DNS resolution override (like curl --resolve)
type DNSResolve struct {
	Host    string `json:"host"`
	Port    string `json:"port"`
	Address string `json:"address"`
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
	Pods             []PodInfo             `json:"pods"`
	Services         []ServiceInfo         `json:"services"`
	
	// Gateway API Resources
	Gateways         []GatewayInfo         `json:"gateways"`
	HTTPRoutes       []HTTPRouteInfo       `json:"httpRoutes"`
	
	// Istio Resources
	VirtualServices  []VirtualServiceInfo  `json:"virtualServices"`
	IstioGateways    []IstioGatewayInfo    `json:"istioGateways"`
	DestinationRules []DestinationRuleInfo `json:"destinationRules"`
	ServiceEntries   []ServiceEntryInfo    `json:"serviceEntries"`
	AuthorizationPolicies []AuthorizationPolicyInfo `json:"authorizationPolicies"`
	PeerAuthentications []PeerAuthenticationInfo `json:"peerAuthentications"`
	
	// KServe Resources
	InferenceServices []InferenceServiceInfo `json:"inferenceServices"`
	ServingRuntimes  []ServingRuntimeInfo   `json:"servingRuntimes"`
	ClusterServingRuntimes []ClusterServingRuntimeInfo `json:"clusterServingRuntimes"`
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

// GatewayInfo represents Gateway API gateway information
type GatewayInfo struct {
	Name       string    `json:"name"`
	Namespace  string    `json:"namespace"`
	GatewayClass string  `json:"gatewayClass"`
	Listeners  []string  `json:"listeners"`
	Addresses  []string  `json:"addresses"`
	CreatedAt  time.Time `json:"created"`
}

// HTTPRouteInfo represents Gateway API HTTPRoute information
type HTTPRouteInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Hostnames []string  `json:"hostnames"`
	ParentRefs []string `json:"parentRefs"`
	CreatedAt time.Time `json:"created"`
}

// VirtualServiceInfo represents Istio VirtualService information
type VirtualServiceInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Hosts     []string  `json:"hosts"`
	Gateways  []string  `json:"gateways"`
	CreatedAt time.Time `json:"created"`
}

// IstioGatewayInfo represents Istio Gateway information
type IstioGatewayInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Servers   []string  `json:"servers"`
	Selector  map[string]string `json:"selector"`
	CreatedAt time.Time `json:"created"`
}

// DestinationRuleInfo represents Istio DestinationRule information
type DestinationRuleInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Host      string    `json:"host"`
	Subsets   []string  `json:"subsets"`
	CreatedAt time.Time `json:"created"`
}

// ServiceEntryInfo represents Istio ServiceEntry information
type ServiceEntryInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Hosts     []string  `json:"hosts"`
	Location  string    `json:"location"`
	CreatedAt time.Time `json:"created"`
}

// AuthorizationPolicyInfo represents Istio AuthorizationPolicy information
type AuthorizationPolicyInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Action    string    `json:"action"`
	Rules     int       `json:"rules"`
	CreatedAt time.Time `json:"created"`
}

// PeerAuthenticationInfo represents Istio PeerAuthentication information
type PeerAuthenticationInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Mode      string    `json:"mode"`
	CreatedAt time.Time `json:"created"`
}

// InferenceServiceInfo represents KServe InferenceService information
type InferenceServiceInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Ready     bool      `json:"ready"`
	URL       string    `json:"url"`
	Framework string    `json:"framework"`
	CreatedAt time.Time `json:"created"`
}

// ServingRuntimeInfo represents KServe ServingRuntime information
type ServingRuntimeInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Disabled  bool      `json:"disabled"`
	ModelFormat []string `json:"modelFormat"`
	CreatedAt time.Time `json:"created"`
}

// ClusterServingRuntimeInfo represents KServe ClusterServingRuntime information
type ClusterServingRuntimeInfo struct {
	Name      string    `json:"name"`
	Disabled  bool      `json:"disabled"`
	ModelFormat []string `json:"modelFormat"`
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

// Publishing-related types

// PublishConfig represents model publishing configuration
type PublishConfig struct {
	TenantID        string            `json:"tenantId" binding:"required"`
	ModelType       string            `json:"modelType"` // "traditional" or "openai"
	ExternalPath    string            `json:"externalPath"`
	PublicHostname  string            `json:"publicHostname"` // Public hostname for model access
	RateLimiting    RateLimitConfig   `json:"rateLimiting"`
	Authentication  AuthConfig        `json:"authentication"`
	Metadata        map[string]string `json:"metadata"`
}

// RateLimitConfig represents rate limiting configuration
type RateLimitConfig struct {
	RequestsPerMinute int `json:"requestsPerMinute"`
	RequestsPerHour   int `json:"requestsPerHour"`
	TokensPerHour     int `json:"tokensPerHour"` // For OpenAI models
	BurstLimit        int `json:"burstLimit"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	RequireAPIKey  bool     `json:"requireApiKey"`
	AllowedTenants []string `json:"allowedTenants"`
}

// PublishedModel represents a published model
type PublishedModel struct {
	ModelName       string            `json:"modelName"`
	Namespace       string            `json:"namespace"`
	TenantID        string            `json:"tenantId"`
	ModelType       string            `json:"modelType"`
	ExternalURL     string            `json:"externalUrl"`
	PublicHostname  string            `json:"publicHostname"`
	APIKey          string            `json:"apiKey"`
	RateLimiting    RateLimitConfig   `json:"rateLimiting"`
	Status          string            `json:"status"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
	Usage           UsageStats        `json:"usage"`
	Documentation   APIDocumentation  `json:"documentation"`
}

// APIKeyMetadata represents API key metadata
type APIKeyMetadata struct {
	KeyID       string    `json:"keyId"`
	ModelName   string    `json:"modelName"`
	Namespace   string    `json:"namespace"`
	TenantID    string    `json:"tenantId"`
	ModelType   string    `json:"modelType"`
	CreatedAt   time.Time `json:"createdAt"`
	ExpiresAt   time.Time `json:"expiresAt,omitempty"`
	LastUsed    time.Time `json:"lastUsed,omitempty"`
	IsActive    bool      `json:"isActive"`
	Permissions []string  `json:"permissions"`
}

// UsageStats represents usage statistics
type UsageStats struct {
	TotalRequests   int64     `json:"totalRequests"`
	RequestsToday   int64     `json:"requestsToday"`
	TokensUsed      int64     `json:"tokensUsed"` // For OpenAI models
	LastAccessTime  time.Time `json:"lastAccessTime"`
}

// APIDocumentation represents API documentation
type APIDocumentation struct {
	EndpointURL     string            `json:"endpointUrl"`
	AuthHeaders     map[string]string `json:"authHeaders"`
	ExampleRequests []ExampleRequest  `json:"exampleRequests"`
	SDKExamples     map[string]string `json:"sdkExamples"` // Language -> code
}

// ExampleRequest represents an example API request
type ExampleRequest struct {
	Method      string            `json:"method"`
	URL         string            `json:"url"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	Description string            `json:"description"`
}


// Publishing request/response types
type PublishModelRequest struct {
	Config PublishConfig `json:"config" binding:"required"`
}

type PublishModelResponse struct {
	Message       string        `json:"message"`
	PublishedModel PublishedModel `json:"publishedModel"`
}

type ListPublishedModelsResponse struct {
	PublishedModels []PublishedModel `json:"publishedModels"`
	Total           int              `json:"total"`
}

type RotateAPIKeyResponse struct {
	Message    string        `json:"message"`
	NewAPIKey  string        `json:"newApiKey"`
	UpdatedAt  time.Time     `json:"updatedAt"`
}

// Test execution types for DeveloperConsole
type TestExecutionRequest struct {
	ModelName         string             `json:"modelName" binding:"required"`
	TestData          interface{}        `json:"testData" binding:"required"`
	CustomEndpoint    string             `json:"customEndpoint,omitempty"`
	CustomHeaders     []HeaderSetting    `json:"customHeaders,omitempty"`
	CustomMethod      string             `json:"customMethod,omitempty"`
	UseCustomConfig   bool               `json:"useCustomConfig"`
	ConnectionSettings *ConnectionSettings `json:"connectionSettings,omitempty"`
}

type TestExecutionResponse struct {
	Success      bool                   `json:"success"`
	Data         interface{}            `json:"data,omitempty"`
	Error        string                 `json:"error,omitempty"`
	Request      interface{}            `json:"request"`
	Endpoint     string                 `json:"endpoint"`
	Status       string                 `json:"status"`
	StatusCode   int                    `json:"statusCode"`
	ResponseTime int64                  `json:"responseTime"`
	Headers      map[string]string      `json:"headers,omitempty"`
	Timestamp    time.Time              `json:"timestamp"`
}

type TestHistoryResponse struct {
	Tests []TestExecutionResponse `json:"tests"`
	Total int                     `json:"total"`
}