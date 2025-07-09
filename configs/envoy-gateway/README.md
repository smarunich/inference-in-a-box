# Envoy Gateway Configuration

This directory contains the complete Envoy Gateway configuration for the AI inference platform, organized by functionality for easy navigation and maintenance.

## Directory Structure

```
envoy-gateway/
├── README.md                 # This file
├── gateway/                  # Core gateway configuration
│   ├── gatewayclass.yaml    # Gateway class definitions
│   └── ai-gateway.yaml      # Main AI inference gateway
├── security/                 # Security and authentication
│   └── jwt-security-policy.yaml # JWT authentication and authorization
├── backends/                 # Backend service definitions
│   ├── backends.yaml        # Standard backend definitions
│   ├── ai-backends.yaml     # AI-specific backend configurations
│   └── ai-service-backends.yaml # AI service backend mappings
├── routing/                  # Traffic routing configuration
│   └── httproute.yaml       # HTTP route definitions
└── policies/                 # Traffic policies
    └── rate-limiting.yaml   # Rate limiting and traffic policies
```

## Architecture Overview

```mermaid
graph TB
    %% External Traffic
    Client[Client/User] --> Gateway[AI Inference Gateway<br/>:80, :443]
    
    %% Gateway Layer
    Gateway --> JWT{JWT<br/>Authentication}
    JWT -->|Valid Token| Routes[HTTP Routes]
    JWT -->|Invalid Token| Deny[❌ Denied]
    
    %% Routing Layer
    Routes --> ModelA[/v1/models/sklearn-iris]
    Routes --> ModelB[/v1/models/pytorch-resnet]
    Routes --> Fallback[/* Fallback]
    
    %% Backend Services
    ModelA --> BackendA[sklearn-iris-backend<br/>tenant-a:80]
    ModelB --> BackendB[pytorch-resnet-backend<br/>tenant-c:80]
    Fallback --> BackendC[istio-gateway-backend<br/>istio-system:80]
    
    %% Security & Policy Layer
    subgraph Security [Security Layer]
        JWT
        Auth[Authorization Rules<br/>tenant-a, tenant-b, tenant-c]
        JWKS[JWT Server<br/>JWKS Endpoint]
    end
    
    subgraph Policies [Policy Layer]
        RateLimit[Rate Limiting<br/>100 req/min per tenant<br/>1000 req/min global]
        CircuitBreaker[Circuit Breaker<br/>Max: 100 conn, 50 pending]
        HealthCheck[Health Checks<br/>Active monitoring]
    end
    
    %% Backend Infrastructure
    subgraph Backends [Backend Services]
        BackendA
        BackendB
        BackendC
    end
    
    %% Apply policies to all traffic
    Gateway -.-> Policies
    Routes -.-> Policies
    
    %% JWT validation
    JWT -.-> JWKS
    Auth -.-> JWT
    
    %% Styling
    classDef gateway fill:#e1f5fe
    classDef security fill:#fff3e0
    classDef policy fill:#f3e5f5
    classDef backend fill:#e8f5e8
    classDef client fill:#ffebee
    
    class Gateway gateway
    class JWT,Auth,JWKS security
    class RateLimit,CircuitBreaker,HealthCheck policy
    class BackendA,BackendB,BackendC backend
    class Client client
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant C as Client
    participant G as AI Gateway
    participant J as JWT Server
    participant P as Policy Engine
    participant B as Backend Service
    
    C->>G: Request with Bearer Token
    G->>J: Validate JWT (JWKS)
    J-->>G: Token Valid + Claims
    G->>P: Apply Rate Limiting
    P-->>G: Request Allowed
    G->>G: Route Selection (/v1/models/*)
    G->>B: Forward to Backend
    B-->>G: Model Response
    G->>P: Apply Circuit Breaker
    P-->>G: Response Allowed
    G-->>C: Return Response
    
    Note over G,J: RSA-256 JWT Validation
    Note over G,P: Per-tenant Rate Limiting
    Note over G,B: Health Check Monitoring
```

## Configuration Object Relationships

```mermaid
graph TB
    subgraph "Gateway Foundation" [Gateway Foundation]
        GC[GatewayClass<br/>ai-gateway-class]
        G[Gateway<br/>ai-inference-gateway]
        AGR[AIGatewayRoute<br/>ai-inference-gateway]
    end
    
    subgraph "Backend Definitions" [Backend Services]
        B1[Backend<br/>sklearn-iris-backend]
        B2[Backend<br/>pytorch-resnet-backend]
        B3[Backend<br/>istio-gateway-backend]
        B4[Backend<br/>remote-jwks]
        
        ASB1[AIServiceBackend<br/>sklearn-iris-backend]
        ASB2[AIServiceBackend<br/>pytorch-resnet-backend]
        ASB3[AIServiceBackend<br/>istio-gateway-backend]
    end
    
    subgraph "Security & Policies" [Security & Traffic Management]
        SP[SecurityPolicy<br/>jwt-auth-policy]
        BTP[BackendTrafficPolicy<br/>ai-gateway-traffic-policy]
    end
    
    subgraph "Routing Configuration" [Traffic Routing]
        HR[HTTPRoute<br/>ai-inference-routes]
    end
    
    %% Gateway Foundation Relationships
    GC -->|gatewayClassName| G
    G -->|targetRefs| AGR
    G -->|parentRefs| HR
    
    %% Backend Relationships
    B1 -->|backendRef| ASB1
    B2 -->|backendRef| ASB2
    B3 -->|backendRef| ASB3
    
    %% Security Policy Relationships
    SP -->|targetRefs| HR
    SP -->|remoteJWKS.backendRefs| B4
    
    %% Traffic Policy Relationships
    BTP -->|targetRefs| G
    
    %% Routing Relationships
    HR -->|backendRefs| B1
    HR -->|backendRefs| B2
    HR -->|backendRefs| B3
    
    %% AI Gateway Route Relationships
    AGR -->|backendRefs| ASB1
    AGR -->|backendRefs| ASB2
    AGR -->|backendRefs| ASB3
    
    %% Reference Labels
    GC -.->|"spec.gatewayClassName"| G
    G -.->|"spec.targetRefs"| AGR
    G -.->|"spec.parentRefs"| HR
    SP -.->|"spec.targetRefs"| HR
    BTP -.->|"spec.targetRefs"| G
    
    %% Styling
    classDef gateway fill:#e1f5fe
    classDef backend fill:#e8f5e8
    classDef security fill:#fff3e0
    classDef routing fill:#f3e5f5
    
    class GC,G,AGR gateway
    class B1,B2,B3,B4,ASB1,ASB2,ASB3 backend
    class SP,BTP security
    class HR routing
```

## Kubernetes Resource Dependencies

```mermaid
graph TD
    subgraph "Namespace: envoy-gateway-system"
        subgraph "Core Resources"
            GC[GatewayClass<br/>ai-gateway-class<br/>cluster-scoped]
            G[Gateway<br/>ai-inference-gateway]
            HR[HTTPRoute<br/>ai-inference-routes]
            AGR[AIGatewayRoute<br/>ai-inference-gateway]
        end
        
        subgraph "Backend Resources"
            B1[Backend<br/>sklearn-iris-backend]
            B2[Backend<br/>pytorch-resnet-backend]
            B3[Backend<br/>istio-gateway-backend]
            B4[Backend<br/>remote-jwks]
            
            ASB1[AIServiceBackend<br/>sklearn-iris-backend]
            ASB2[AIServiceBackend<br/>pytorch-resnet-backend]
            ASB3[AIServiceBackend<br/>istio-gateway-backend]
        end
        
        subgraph "Policy Resources"
            SP[SecurityPolicy<br/>jwt-auth-policy]
            BTP[BackendTrafficPolicy<br/>ai-gateway-traffic-policy]
        end
    end
    
    subgraph "External Dependencies"
        subgraph "default namespace"
            JS[Service<br/>jwt-server]
        end
        
        subgraph "tenant-a namespace"
            MS1[Service<br/>sklearn-iris-predictor-default]
        end
        
        subgraph "tenant-c namespace"
            MS2[Service<br/>pytorch-resnet-predictor-default]
        end
        
        subgraph "istio-system namespace"
            IS[Service<br/>istio-ingressgateway]
        end
    end
    
    %% Object References
    GC -.->|controllerName| G
    G -.->|spec.gatewayClassName| GC
    HR -.->|spec.parentRefs| G
    AGR -.->|spec.targetRefs| G
    SP -.->|spec.targetRefs| HR
    BTP -.->|spec.targetRefs| G
    
    %% Backend References
    B1 -.->|spec.endpoints.fqdn| MS1
    B2 -.->|spec.endpoints.fqdn| MS2
    B3 -.->|spec.endpoints.fqdn| IS
    B4 -.->|spec.endpoints.fqdn| JS
    
    ASB1 -.->|spec.backendRef| B1
    ASB2 -.->|spec.backendRef| B2
    ASB3 -.->|spec.backendRef| B3
    
    %% Route References
    HR -.->|spec.rules.backendRefs| B1
    HR -.->|spec.rules.backendRefs| B2
    HR -.->|spec.rules.backendRefs| B3
    
    AGR -.->|spec.rules.backendRefs| ASB1
    AGR -.->|spec.rules.backendRefs| ASB2
    AGR -.->|spec.rules.backendRefs| ASB3
    
    %% Security References
    SP -.->|spec.jwt.providers.remoteJWKS.backendRefs| B4
    
    %% Styling
    classDef gateway fill:#e1f5fe,stroke:#01579b
    classDef backend fill:#e8f5e8,stroke:#1b5e20
    classDef security fill:#fff3e0,stroke:#e65100
    classDef routing fill:#f3e5f5,stroke:#4a148c
    classDef external fill:#ffebee,stroke:#b71c1c
    
    class GC,G,AGR gateway
    class B1,B2,B3,B4,ASB1,ASB2,ASB3 backend
    class SP,BTP security
    class HR routing
    class JS,MS1,MS2,IS external
```

## Component Interaction Matrix

```mermaid
graph LR
    subgraph Configuration ["Configuration Files"]
        GCF[gateway/gatewayclass.yaml]
        AGF[gateway/ai-gateway.yaml]
        SPF[security/jwt-security-policy.yaml]
        BEF[backends/backends.yaml]
        ASBF[backends/ai-service-backends.yaml]
        HRF[routing/httproute.yaml]
        TPF[policies/rate-limiting.yaml]
    end
    
    subgraph Runtime ["Runtime Components"]
        EG[Envoy Gateway Controller]
        EP[Envoy Proxy Instances]
        JS[JWT Server Pod]
        MS[Model Service Pods]
    end
    
    %% Configuration to Runtime Mapping
    GCF --> EG
    AGF --> EP
    SPF --> JS
    BEF --> MS
    ASBF --> MS
    HRF --> EP
    TPF --> EP
    
    %% Runtime Dependencies
    EG --> EP
    EP --> JS
    EP --> MS
    
    %% File Dependencies (deployment order)
    GCF -.-> AGF
    AGF -.-> BEF
    BEF -.-> ASBF
    ASBF -.-> SPF
    SPF -.-> HRF
    HRF -.-> TPF
    
    classDef config fill:#e3f2fd,stroke:#0277bd
    classDef runtime fill:#fff8e1,stroke:#f57c00
    
    class GCF,AGF,SPF,BEF,ASBF,HRF,TPF config
    class EG,EP,JS,MS runtime
```

## Configuration Overview

### Gateway Configuration (`gateway/`)

#### `gatewayclass.yaml`
- **Purpose**: Defines gateway classes for the Envoy Gateway controller
- **Resources**:
  - `ai-gateway-class`: Specialized gateway class for AI workloads
  - `eg`: Standard Envoy Gateway class
- **Key Features**: AI-specific capabilities and standard gateway functionality

#### `ai-gateway.yaml`
- **Purpose**: Main gateway configuration for AI inference
- **Resources**:
  - `ai-inference-gateway`: Primary gateway with HTTP/HTTPS listeners
  - `ai-inference-gateway` (AIGatewayRoute): AI-specific routing rules
- **Key Features**:
  - HTTP (port 80) and HTTPS (port 443) listeners
  - TLS termination with `ai-gateway-tls` certificate
  - Tenant-based routing with header matching
  - OpenAI schema compatibility

### Security Configuration (`security/`)

#### `jwt-security-policy.yaml`
- **Purpose**: JWT authentication and authorization policies
- **Resources**:
  - `jwt-auth-policy`: SecurityPolicy for JWT validation
  - `remote-jwks`: Backend for JWKS endpoint
- **Key Features**:
  - RSA-based JWT validation with remote JWKS
  - Tenant-based authorization rules
  - Retry mechanism for JWKS fetching
  - Claims validation for tenant access

**Security Model**:
- **Authentication**: Bearer token validation against JWT server
- **Authorization**: Tenant claim validation (`tenant-a`, `tenant-b`, `tenant-c`)
- **Default**: Deny all requests without valid JWT

### Backend Configuration (`backends/`)

#### `backends.yaml`
- **Purpose**: Standard backend endpoint definitions
- **Resources**:
  - `sklearn-iris-backend`: scikit-learn model backend
  - `pytorch-resnet-backend`: PyTorch model backend
  - `istio-gateway-backend`: Fallback to Istio gateway
- **Key Features**: FQDN-based service discovery

#### `ai-backends.yaml`
- **Purpose**: AI-specific backend configurations (legacy)
- **Resources**: AIServiceBackend definitions with retry policies
- **Key Features**:
  - Configurable timeouts (30s)
  - Retry mechanisms with exponential backoff
  - Path prefix routing

#### `ai-service-backends.yaml`
- **Purpose**: AI service backend mappings
- **Resources**: AIServiceBackend resources with OpenAI schema
- **Key Features**:
  - OpenAI API compatibility
  - Backend reference mapping
  - Standardized AI service interface

### Routing Configuration (`routing/`)

#### `httproute.yaml`
- **Purpose**: HTTP traffic routing rules
- **Resources**: `ai-inference-routes` HTTPRoute
- **Key Features**:
  - **JWT-Protected Routes**: 
    - `/v1/models/sklearn-iris` → `tenant-a` namespace
    - `/v1/models/pytorch-resnet` → `tenant-c` namespace
  - **Request Modification**: Automatic tenant and gateway header injection
  - **Fallback Routing**: Unmatched requests forwarded to Istio gateway
  - **Authorization**: Bearer token requirement for model routes

### Policy Configuration (`policies/`)

#### `rate-limiting.yaml`
- **Purpose**: Traffic management and resilience policies
- **Resources**: `ai-gateway-traffic-policy` BackendTrafficPolicy
- **Key Features**:
  - **Rate Limiting**:
    - Per-tenant: 100 requests/minute
    - Global: 1000 requests/minute
  - **Circuit Breaker**:
    - Max connections: 100
    - Max pending requests: 50
    - Max parallel requests: 200
  - **Retry Policy**: 3 retries on 5xx errors
  - **Timeouts**: 
    - TCP connect: 10s
    - HTTP request: 30s
    - Connection idle: 60s
  - **Health Checks**: Active health monitoring

## Deployment Order

Deploy configurations in the following order to ensure proper dependencies:

1. **Gateway Foundation**:
   ```bash
   kubectl apply -f gateway/gatewayclass.yaml
   kubectl apply -f gateway/ai-gateway.yaml
   ```

2. **Backend Services**:
   ```bash
   kubectl apply -f backends/backends.yaml
   kubectl apply -f backends/ai-service-backends.yaml
   ```

3. **Security Policies**:
   ```bash
   kubectl apply -f security/jwt-security-policy.yaml
   ```

4. **Routing Rules**:
   ```bash
   kubectl apply -f routing/httproute.yaml
   ```

5. **Traffic Policies**:
   ```bash
   kubectl apply -f policies/rate-limiting.yaml
   ```

## Configuration Validation

### Prerequisites
- Envoy Gateway installed and running
- JWT server deployed and accessible
- Target AI model services running in respective namespaces

### Validation Commands

```bash
# Verify gateway status
kubectl get gateway ai-inference-gateway -n envoy-gateway-system

# Check security policy
kubectl get securitypolicy jwt-auth-policy -n envoy-gateway-system

# Validate backends
kubectl get backend -n envoy-gateway-system

# Test JWT authentication
curl -H "Authorization: Bearer <jwt-token>" \
     https://your-gateway/v1/models/sklearn-iris:predict
```

## Troubleshooting

### Common Issues

1. **JWT Authentication Failures**:
   - Check JWT server accessibility: `kubectl get backend remote-jwks -n envoy-gateway-system`
   - Verify JWKS endpoint: `curl http://jwt-server.default.svc.cluster.local:8080/.well-known/jwks.json`

2. **Rate Limiting Issues**:
   - Check traffic policy status: `kubectl describe backendtrafficpolicy ai-gateway-traffic-policy -n envoy-gateway-system`
   - Monitor rate limit metrics in Envoy admin interface

3. **Backend Connection Issues**:
   - Verify backend health: `kubectl get backend <backend-name> -n envoy-gateway-system -o yaml`
   - Check target service availability: `kubectl get svc -n <target-namespace>`

### Debug Commands

```bash
# Check Envoy proxy logs
kubectl logs -l app=envoy-gateway -n envoy-gateway-system

# View gateway configuration
kubectl get gateway ai-inference-gateway -n envoy-gateway-system -o yaml

# Check route status
kubectl get httproute ai-inference-routes -n envoy-gateway-system -o yaml
```

## Security Considerations

- **JWT Tokens**: Use strong RSA keys and implement proper token rotation
- **TLS**: Ensure valid certificates for HTTPS listeners
- **Rate Limiting**: Adjust limits based on expected traffic patterns
- **Backend Security**: Verify backend service security configurations
- **Network Policies**: Implement Kubernetes network policies for additional security

## Monitoring and Observability

- **Metrics**: Envoy Gateway exposes Prometheus metrics
- **Tracing**: Configure OpenTelemetry for distributed tracing
- **Logging**: Enable access logs for audit and debugging
- **Health Checks**: Monitor active health check status

## Maintenance

- **Regular Updates**: Keep Envoy Gateway and configurations updated
- **Certificate Rotation**: Implement automated TLS certificate renewal
- **Configuration Validation**: Use CI/CD pipelines for configuration validation
- **Backup**: Maintain versioned backups of configurations