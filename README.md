# 🚀 Inference-in-a-Box: Enterprise AI/ML Platform Demo

A complete, production-ready inference platform that demonstrates enterprise-grade AI/ML model serving using modern cloud-native technologies. This platform combines **Envoy AI Gateway**, **Istio service mesh**, **KServe serverless model serving**, and **comprehensive observability** to create a robust, scalable, and secure inference-as-a-service solution.

## 🎯 What You're Building

**Inference-in-a-Box** is a comprehensive demonstration of how modern organizations can deploy AI/ML models at enterprise scale with:

- **🔒 Zero-Trust Security** - Automatic mTLS encryption, fine-grained authorization, and compliance-ready audit logging
- **⚡ Serverless Inference** - Auto-scaling from zero to N instances based on traffic demand
- **🌐 Multi-Tenant Architecture** - Secure isolation between different teams, projects, and customers
- **📊 Enterprise Observability** - Full-stack monitoring, distributed tracing, and AI-specific metrics
- **🚪 Unified AI Gateway** - Envoy AI Gateway as the primary entry point with JWT authentication and intelligent routing
- **🎛️ Traffic Management** - Canary deployments, A/B testing, and intelligent routing

## 🏗️ Platform Architecture

```mermaid
graph TB
    subgraph "Inference-in-a-Box Cluster"
        subgraph "Tier-1 Gateway Layer (Primary Entry Point)"
            EG[Envoy Gateway]
            EAG[Envoy AI Gateway]
            AUTH[JWT Authentication]
            RL[Rate Limiting]
        end
        
        subgraph "Tier-2 Service Mesh Layer"
            IC[Istiod]
            IG[Istio Gateway]
            MTLS[mTLS Encryption]
        end
        
        subgraph "Multi-Tenant Model Serving"
            subgraph "Tenant A"
                KS1[sklearn-iris]
                IS1[Istio Sidecar]
            end
            subgraph "Tenant B"
                KS2[Reserved]
                IS2[Istio Sidecar]
            end
            subgraph "Tenant C"
                KS3[pytorch-resnet]
                IS3[Istio Sidecar]
            end
        end
        
        subgraph "Serverless Infrastructure"
            KC[KServe Controller]
            KN[Knative Serving]
            CM[Cert Manager]
        end
        
        subgraph "Observability Stack"
            P[Prometheus]
            G[Grafana]
            K[Kiali]
            AM[AlertManager]
        end
    end
    
    subgraph "External"
        CLIENT[AI Client Apps]
        MODELS[Model Registry]
    end
    
    %% Primary Traffic Flow (Tier-1 → Tier-2)
    CLIENT -->|HTTP/REST| EAG
    EAG -->|JWT Validation| AUTH
    AUTH -->|Authenticated| RL
    RL -->|Rate Limited| IG
    IG -->|mTLS Routing| KS1
    IG -->|mTLS Routing| KS3
    
    %% Gateway Integration
    EG -->|Controls| EAG
    IC -->|Manages| IG
    IC -->|Enables| MTLS
    
    %% Model Serving Infrastructure
    KC -->|Manages| KN
    KN -->|Serves| KS1
    KN -->|Serves| KS2
    KN -->|Serves| KS3
    
    %% External Model Sources
    MODELS -->|Deploys| KS1
    MODELS -->|Deploys| KS2
    MODELS -->|Deploys| KS3
    
    %% Observability Flow
    KS1 -->|Metrics| P
    KS2 -->|Metrics| P
    KS3 -->|Metrics| P
    IC -->|Mesh Metrics| P
    P -->|Data| G
    P -->|Data| K
    
    %% Styling
    classDef tier1 fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef tier2 fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef models fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef observability fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class EG,EAG,AUTH,RL tier1
    class IC,IG,MTLS tier2
    class KS1,KS2,KS3,KC,KN,CM models
    class P,G,K,AM observability
```

## 🛠️ Technology Stack

### Core Platform Components
- **🐳 Kind** - Local Kubernetes cluster for development and testing
- **🚪 Envoy Gateway** - Cloud-native API gateway with advanced routing capabilities
- **🤖 Envoy AI Gateway** - AI-specific gateway with JWT authentication and model routing
- **🕸️ Istio** - Service mesh for security, traffic management, and observability
- **🦾 KServe** - Kubernetes-native model serving with auto-scaling
- **🌊 Knative** - Serverless framework for event-driven applications
- **🔐 Cert Manager** - Automated certificate management

### Observability & Monitoring
- **📈 Prometheus** - Metrics collection and alerting
- **📊 Grafana** - Visualization and dashboards
- **🔍 Jaeger** - Distributed tracing
- **🗺️ Kiali** - Service mesh visualization
- **🚨 AlertManager** - Alert routing and management

### AI/ML Support
- **🧠 TensorFlow Serving** - TensorFlow model serving
- **🔥 PyTorch Serve** - PyTorch model serving  
- **⚡ Scikit-learn** - Traditional ML model serving
- **🤗 Hugging Face** - Transformer model support

## 🎯 Key Features Demonstrated

### 🔒 Enterprise Security
```mermaid
sequenceDiagram
    participant Client
    participant Gateway as Envoy AI Gateway
    participant Auth as Authentication
    participant Istio as Istio Proxy
    participant Model as KServe Model
    
    Client->>Gateway: Inference Request
    Gateway->>Auth: Validate JWT/API Key
    Auth-->>Gateway: Authentication Result
    Gateway->>Istio: Forward Request (mTLS)
    Istio->>Model: Secure Request
    Model-->>Istio: Inference Response
    Istio-->>Gateway: Secure Response
    Gateway-->>Client: Final Response
    
    Note over Gateway,Model: All communication encrypted with mTLS
    Note over Auth: RBAC policies enforced
    Note over Istio: Zero-trust networking
```

- **Zero-trust networking** with automatic mTLS between all services
- **Multi-tenant isolation** with namespace-based security boundaries
- **RBAC and authentication** with JWT/API key validation
- **Audit logging** for compliance requirements (GDPR, HIPAA, SOC 2)
- **Certificate management** with automatic rotation

### ⚡ AI/ML Model Serving
```mermaid
graph LR
    subgraph "Model Lifecycle"
        MR[Model Registry] --> KS[KServe Controller]
        KS --> KN[Knative Serving]
        KN --> POD[Model Pods]
    end
    
    subgraph "Auto-scaling"
        POD --> AS[Auto-scaler]
        AS --> |Scale Up| POD
        AS --> |Scale to Zero| ZERO[No Pods]
        ZERO --> |Cold Start| POD
    end
    
    subgraph "Traffic Management"
        CANARY[Canary Deploy]
        AB[A/B Testing]
        BLUE[Blue/Green]
    end
    
    POD --> CANARY
    POD --> AB
    POD --> BLUE
```

- **Serverless auto-scaling** from zero to N instances based on demand
- **Multi-framework support** (Scikit-learn, PyTorch, TensorFlow, Hugging Face)
- **AI Gateway routing** with intelligent path-based and header-based routing
- **Canary deployments** for gradual model rollouts
- **A/B testing** with intelligent traffic splitting
- **Model versioning** and rollback capabilities
- **Resource optimization** with GPU/CPU scheduling

### 🌐 Multi-Tenancy & Governance
- **Workspace isolation** with dedicated namespaces per tenant
- **Resource quotas** and governance policies
- **Separate observability** scopes for each tenant
- **Independent lifecycle** management and deployment schedules
- **Cost tracking** and chargeback mechanisms

### 📊 Comprehensive Observability
```mermaid
graph TB
    subgraph "Metrics Pipeline"
        ISTIO[Istio Metrics] --> PROM[Prometheus]
        KSERVE[KServe Metrics] --> PROM
        CUSTOM[Custom AI Metrics] --> PROM
        PROM --> GRAF[Grafana Dashboards]
    end
    
    subgraph "Tracing Pipeline"
        REQ[Request Traces] --> JAEGER[Jaeger]
        SPANS[Service Spans] --> JAEGER
        JAEGER --> ANALYSIS[Trace Analysis]
    end
    
    subgraph "Logging Pipeline"
        LOGS[Application Logs] --> LOKI[Loki]
        AUDIT[Audit Logs] --> LOKI
        LOKI --> GRAF
    end
    
    subgraph "Alerting"
        PROM --> ALERT[AlertManager]
        ALERT --> SLACK[Slack/Email]
    end
```

- **End-to-end distributed tracing** across the entire inference pipeline
- **AI-specific metrics** including inference latency, throughput, and accuracy
- **Business metrics** for cost optimization and resource planning
- **SLA monitoring** with automated alerting
- **Unified dashboards** for operational visibility

## 🚀 Quick Start

### Prerequisites
Ensure you have the following tools installed:
```bash
# Required tools
docker --version          # Docker 20.10+
kind --version           # Kind 0.20+
kubectl version --client  # kubectl 1.24+
helm version             # Helm 3.12+
curl --version           # curl (any recent version)
jq --version             # jq 1.6+

# Optional but recommended
istioctl version         # Istio CLI (auto-installed by bootstrap)
```

### System Requirements
- **Memory**: Minimum 8GB RAM (16GB recommended for full observability stack)
- **CPU**: 4+ cores recommended
- **Disk**: 20GB+ free space for container images
- **OS**: macOS, Linux, or Windows with WSL2

### One-Command Bootstrap
```bash
# Clone the repository
git clone <repository-url>
cd inference-in-a-box

# Bootstrap the entire platform (takes 10-15 minutes)
./scripts/bootstrap.sh

# Run demo scenarios
./scripts/demo.sh

# Access the platform (run these in separate terminals)
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80 &
kubectl port-forward -n envoy-gateway-system svc/envoy-ai-gateway 8080:80 &
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090 &
kubectl port-forward -n monitoring svc/kiali 20001:20001 &
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686 &
kubectl port-forward -n default svc/management-service 8085:80 &

echo "🎉 Platform is ready!"
echo "🤖 AI Gateway (Primary Entry): http://localhost:8080"
echo "📊 Grafana: http://localhost:3000 (admin/prom-operator)"
echo "📈 Prometheus: http://localhost:9090"
echo "🗺️ Kiali: http://localhost:20001"
echo "🔍 Jaeger: http://localhost:16686"
echo "🔧 Management UI: http://localhost:8085"
echo ""
echo "💡 All AI/ML requests go through the AI Gateway first!"
echo "   The AI Gateway handles JWT auth and routes to Istio Gateway"
```

### Step-by-Step Setup
```bash
# 1. Create Kind cluster
./scripts/clusters/create-kind-cluster.sh

# 2. Install core infrastructure
./scripts/install/install-envoy-gateway.sh
./scripts/install/install-istio.sh
./scripts/install/install-kserve.sh
./scripts/install/install-observability.sh

# 3. Deploy sample models
./scripts/models/deploy-samples.sh

# 4. Configure security and policies
./scripts/security/setup-policies.sh

# 5. Run tests
./scripts/test/run-tests.sh
```

## Features Demonstrated

### 🔒 Enterprise Security
- Zero-trust networking with automatic mTLS
- Multi-tenant isolation with workspace boundaries
- RBAC and authentication policies
- Certificate management and rotation

### 🎯 AI/ML Model Serving
- Multiple ML frameworks (TensorFlow, PyTorch, Scikit-learn)
- Auto-scaling from zero to N instances
- Canary deployments and A/B testing
- Model versioning and rollback

### 🌐 Traffic Management
- Intelligent routing and load balancing
- Circuit breaking and failover
- Rate limiting and throttling
- Geographic routing simulation

### 📊 Observability
- Distributed tracing across the inference pipeline
- Custom metrics for AI workloads
- Unified logging and monitoring
- SLA tracking and alerting

### 🏢 Multi-Tenancy
- Namespace-based tenant isolation
- Resource quotas and governance
- Separate observability scopes
- Independent lifecycle management

## Directory Structure

```
inference-in-a-box/
├── README.md
├── scripts/
│   ├── bootstrap.sh
│   ├── cleanup.sh
│   ├── demo.sh
│   └── clusters/
│       ├── create-kind-cluster.sh
│       └── setup-networking.sh
├── configs/
│   ├── clusters/
│   │   └── cluster.yaml
│   ├── envoy-gateway/
│   │   ├── gatewayclass.yaml
│   │   ├── ai-gateway.yaml
│   │   ├── httproute.yaml
│   │   ├── ai-backends.yaml
│   │   ├── security-policies.yaml
│   │   └── rate-limiting.yaml
│   ├── istio/
│   │   ├── installation.yaml
│   │   ├── gateway.yaml
│   │   └── virtual-services/
│   ├── kserve/
│   │   ├── installation.yaml
│   │   └── models/
│   ├── envoy-ai-gateway/
│   │   └── configuration.yaml
│   └── observability/
│       ├── prometheus.yaml
│       └── grafana/
├── models/
│   ├── sklearn-iris/
│   ├── tensorflow-mnist/
│   └── pytorch-resnet/
├── examples/
│   ├── inference-requests/
│   ├── security-policies/
│   └── traffic-scenarios/
└── docs/
    ├── architecture.md
    ├── deployment-guide.md
    └── troubleshooting.md
```

## Prerequisites

- Docker Desktop or equivalent
- kubectl
- kind
- helm
- curl
- jq

## 🎭 Demo Scenarios

### 1. 🔒 Security & Authentication Demo
```mermaid
sequenceDiagram
    participant User
    participant Gateway
    participant Auth
    participant Model
    
    User->>Gateway: Request with JWT
    Gateway->>Auth: Validate Token
    Auth-->>Gateway: Authorized
    Gateway->>Model: Forward Request (mTLS)
    Model-->>Gateway: Inference Result
    Gateway-->>User: Secure Response
```

### 2. ⚡ Auto-scaling Demo
```bash
# The demo script automatically generates load through the AI Gateway
./scripts/demo.sh
# Select option 2 for auto-scaling demo

# Watch pods scale from 0 to N
watch "kubectl get pods -n tenant-a -l serving.kserve.io/inferenceservice=sklearn-iris"
```

### 3. 🚦 Canary Deployment Demo
```bash
# The demo script creates a canary deployment for sklearn-iris
./scripts/demo.sh
# Select option 3 for canary deployment demo

# Monitor traffic split
kubectl get virtualservice -n tenant-a
```

### 4. 🌐 Multi-Tenant Isolation Demo
```bash
# The demo script shows tenant isolation and resource boundaries
./scripts/demo.sh
# Select option 4 for multi-tenant isolation demo

# Verify isolation
kubectl get networkpolicies -A
```

## 📊 Monitoring & Observability

### Real-time Dashboards
```mermaid
graph LR
    subgraph "Grafana Dashboards"
        OVERVIEW["📊 Platform Overview"]
        MODELS["🤖 Model Performance"]
        SECURITY["🔒 Security Metrics"]
        BUSINESS["💰 Business KPIs"]
    end
    
    subgraph "Data Sources"
        PROM["📈 Prometheus"]
        JAEGER["🔍 Jaeger"]
        ISTIO["🕸️ Istio Metrics"]
        KSERVE["🤖 KServe Metrics"]
    end
    
    PROM --> OVERVIEW
    PROM --> MODELS
    ISTIO --> SECURITY
    KSERVE --> BUSINESS
    JAEGER --> MODELS
```

### Key Metrics Tracked
- **🎯 Model Performance**: Inference latency, throughput, accuracy
- **⚡ Infrastructure**: CPU/Memory usage, auto-scaling events
- **🔒 Security**: Authentication failures, policy violations
- **💰 Business**: Cost per inference, tenant usage, SLA compliance
- **🌐 Network**: Request rates, error rates, circuit breaker events

### Alert Configuration
```yaml
# Example alert rules
groups:
- name: inference.rules
  rules:
  - alert: HighInferenceLatency
    expr: histogram_quantile(0.95, rate(kserve_request_duration_seconds_bucket[5m])) > 1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High inference latency detected"
      
  - alert: ModelDown
    expr: up{job="kserve-model"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Model service is down"
```

## 🌐 Traffic Flow Architecture

### Tier-1/Tier-2 Gateway Design
The platform implements a **two-tier gateway architecture** where external traffic first hits the **Envoy AI Gateway** (Tier-1) and then flows to the **Istio Gateway** (Tier-2) for service mesh routing:

```mermaid
sequenceDiagram
    participant Client as 🖥️ Client Apps
    participant EAG as 🤖 AI Gateway (Tier-1)
    participant Auth as 🔐 JWT Auth
    participant IG as 🕸️ Istio Gateway (Tier-2)
    participant Model as 🎯 Model Service
    
    Client->>EAG: HTTP/REST Request
    EAG->>Auth: Validate JWT Token
    Auth-->>EAG: Token Valid (tenant-x)
    EAG->>EAG: Apply Rate Limits
    EAG->>EAG: Extract Model Name
    EAG->>IG: Route to Service Mesh
    IG->>Model: mTLS Encrypted Request
    Model-->>IG: Inference Response
    IG-->>EAG: Response via Service Mesh
    EAG-->>Client: Final Response
```

### Primary Access Patterns
1. **🎯 AI Model Inference**: `Client → AI Gateway → JWT Auth → Rate Limiting → Istio Gateway → Model Service`
2. **📊 Observability**: `Client → AI Gateway → Istio Gateway → Monitoring Services`
3. **🔧 Management**: `Client → AI Gateway → Istio Gateway → Admin Services`

### Gateway Responsibilities

#### 🚀 Tier-1: Envoy AI Gateway (Primary Entry Point)
- **Authentication**: JWT token validation with JWKS
- **Authorization**: Tenant-based access control
- **Rate Limiting**: Per-tenant and global limits
- **AI Protocol**: OpenAI-compatible API transformation
- **Routing**: Model-aware intelligent routing

#### 🕸️ Tier-2: Istio Gateway (Service Mesh)
- **mTLS**: Service-to-service encryption
- **Load Balancing**: Traffic distribution
- **Circuit Breaking**: Fault tolerance
- **Observability**: Metrics and tracing
- **Service Discovery**: Dynamic routing

## 🚪 AI Gateway Features

### JWT Authentication & Authorization
- **Tenant-specific JWT validation** with dedicated JWKS endpoints
- **Automatic claim extraction** to request headers for downstream services
- **Multi-provider support** for different authentication sources

### Intelligent Routing
- **Model-aware routing** based on x-ai-eg-model header
- **Header-based tenant routing** for multi-tenant isolation
- **Fallback routing** to Istio Gateway for non-AI traffic

### Rate Limiting & Traffic Management
- **Per-tenant rate limiting** with configurable limits
- **Global rate limiting** for platform protection
- **Circuit breaker** patterns for resilience
- **Retry policies** with exponential backoff

### Security & Compliance
- **CORS support** for web applications
- **TLS termination** at the edge
- **Security headers** injection
- **Audit logging** for compliance requirements

### Example API Usage
```bash
# All requests go through the AI Gateway first (Tier-1 Entry Point)
export AI_GATEWAY_URL="http://localhost:8080"
export JWT_TOKEN="<your-jwt-token>"

# Authenticated request to sklearn model (tenant-a)
curl -H "Authorization: Bearer $JWT_TOKEN" \
     -H "x-tenant: tenant-a" \
     -H "x-ai-eg-model: sklearn-iris" \
     $AI_GATEWAY_URL/v1/models/sklearn-iris:predict \
     -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}'

# Authenticated request to pytorch model (tenant-c)
curl -H "Authorization: Bearer $JWT_TOKEN" \
     -H "x-tenant: tenant-c" \
     -H "x-ai-eg-model: pytorch-resnet" \
     $AI_GATEWAY_URL/v1/models/pytorch-resnet:predict \
     -d '{"instances": [[[0.1, 0.2, 0.3]]]}'

# The AI Gateway handles:
# 1. JWT validation and tenant authorization
# 2. Rate limiting and traffic management  
# 3. Model routing based on headers
# 4. OpenAI protocol transformation
# 5. Forwarding to Istio Gateway (Tier-2)
```

## 🚀 Getting Started

### Quick Start Guide
1. **Prerequisites**: Ensure Docker, Kind, kubectl, and Helm are installed
2. **Bootstrap**: Run `./scripts/bootstrap.sh` (takes 10-15 minutes)
3. **Access Services**: Use the port-forward commands above
4. **Run Demos**: Execute `./scripts/demo.sh` for interactive scenarios
5. **Get JWT Tokens**: Run `./scripts/get-jwt-tokens.sh` for authentication

### Development Workflow
- **Management Service**: See [`management/README.md`](management/README.md) for Go backend + React frontend development
- **Configuration**: All Kubernetes configs are in [`configs/`](configs/) directory
- **Scripts**: Automation scripts in [`scripts/`](scripts/) for deployment and testing

### Documentation
- **Architecture**: [`docs/architecture.md`](docs/architecture.md) - Detailed system design
- **Demo Guide**: [`demo.md`](demo.md) - Comprehensive demo instructions
- **Claude Guide**: [`CLAUDE.md`](CLAUDE.md) - AI assistant deployment guidance
- **Getting Started**: [`docs/getting-started.md`](docs/getting-started.md) - Step-by-step setup
- **Usage**: [`docs/usage.md`](docs/usage.md) - API usage and examples

## 🔧 Troubleshooting

### Common Issues
- **Gateway not ready**: Check `kubectl get gateway -n envoy-gateway-system`
- **JWT validation fails**: Verify JWKS endpoint is accessible with `kubectl get pods -n default -l app=jwt-server`
- **Rate limiting**: Check rate limit policies and quotas
- **Model not accessible**: Verify model is ready with `kubectl get inferenceservice --all-namespaces`
- **Port conflicts**: Ensure ports 3000, 8080, 8085, 9090, 16686, 20001 are available

### Verification Commands
```bash
# Check overall cluster health
kubectl get pods --all-namespaces | grep -v Running

# Check gateway status
kubectl get gatewayclass,gateway,httproute -n envoy-gateway-system

# Verify AI Gateway pods
kubectl get pods -n envoy-gateway-system

# Check model connectivity and status
kubectl get inferenceservice --all-namespaces
kubectl describe inferenceservice sklearn-iris -n tenant-a

# Test JWT server
kubectl port-forward -n default svc/jwt-server 8081:8080 &
curl http://localhost:8081/.well-known/jwks.json

# Check observability stack
kubectl get pods -n monitoring
```

### Cleanup
```bash
# Complete cleanup
./scripts/cleanup.sh

# Or manual cleanup
kind delete cluster --name inference-in-a-box
```

## 📝 Version Information
- **Istio**: v1.26.2
- **KServe**: v0.15.2
- **Knative**: v1.18.1
- **Envoy Gateway**: v1.4.1
- **Envoy AI Gateway**: v0.2.1
- **Cert Manager**: v1.18.1
- **Prometheus Stack**: v75.6.0
- **Grafana**: v12.0.2
- **Jaeger**: v3.4.1
- **Kiali**: v2.11.0

## 🤝 Contributing
This is a demonstration project showcasing enterprise AI/ML deployment patterns. For questions or improvements, please refer to the documentation or create an issue.

## 📄 License
MIT License - see LICENSE file for details.