# Technology Stack & Build System

## Core Platform Technologies

### Container Orchestration
- **Kubernetes**: Container orchestration foundation
- **Kind**: Local Kubernetes cluster for development and testing
- **Cluster Name**: `inference-in-a-box`

### Service Mesh & Gateway
- **Istio** (v1.26.2): Service mesh for security, traffic management, and observability
- **Envoy Gateway** (v1.4.1): Kubernetes-native API gateway
- **Envoy AI Gateway** (v0.2.1): AI-specific gateway with JWT authentication and model routing

### AI/ML Serving
- **KServe** (v0.15.2): Kubernetes-native serverless model serving
- **Knative Serving** (v1.18.1): Serverless infrastructure for auto-scaling
- **Supported Frameworks**: TensorFlow, PyTorch, Scikit-learn, Hugging Face, ONNX

### Observability Stack
- **Prometheus** (v2.50.1): Metrics collection and alerting
- **Grafana** (v12.0.2): Visualization and dashboards
- **Jaeger** (v3.4.1): Distributed tracing
- **Kiali** (v2.11.0): Service mesh visualization

### Security & Certificates
- **Cert Manager** (v1.18.1): Automated certificate management
- **JWT Authentication**: Token-based authentication with JWKS validation
- **mTLS**: Automatic mutual TLS for service-to-service communication

## Backend Technologies

### Management Service
- **Language**: Go 1.21
- **Framework**: Gin web framework
- **Architecture**: Consolidated backend + React frontend in single service
- **Authentication**: JWT with golang-jwt/jwt/v5
- **Kubernetes Client**: k8s.io/client-go v0.28.3

### Frontend Technologies
- **Framework**: React 18.2.0
- **Routing**: React Router DOM v6.3.0
- **HTTP Client**: Axios v1.4.0
- **UI Components**: Lucide React icons, React Hot Toast notifications
- **JSON Viewer**: @uiw/react-json-view

## Build System & Common Commands

### Prerequisites Installation
```bash
# Required tools
docker --version          # Docker 20.10+
kind --version           # Kind 0.20+
kubectl version --client  # kubectl 1.24+
helm version             # Helm 3.12+
curl --version           # curl (any recent version)
jq --version             # jq 1.6+
```

### Platform Bootstrap
```bash
# One-command platform setup (10-15 minutes)
./scripts/bootstrap.sh

# Step-by-step setup
./scripts/clusters/create-kind-cluster.sh
./scripts/install/install-envoy-gateway.sh
./scripts/install/install-istio.sh
./scripts/install/install-kserve.sh
./scripts/install/install-observability.sh
```

### Management Service Build
```bash
# Build and deploy management service
./scripts/build-management.sh

# Deploy management service only
./scripts/deploy-management.sh

# Build Docker images
./scripts/build-and-push-images.sh    # Multi-arch images
./scripts/build-local-images.sh       # Local images only
```

### Development Commands
```bash
# Management service development
cd management
go mod download                       # Install Go dependencies
cd ui && npm install && npm run build # Build React UI
go run .                             # Start development server
air                                  # Hot reload (requires: go install github.com/cosmtrek/air@latest)

# Frontend development
cd management/ui
npm start                            # Start React dev server
npm test                             # Run tests
npm run build                        # Build for production
```

### Demo & Testing
```bash
# Run comprehensive demo suite
./scripts/demo.sh

# Individual demo scenarios
./scripts/demo-security.sh           # Security & authentication
./scripts/demo-autoscaling.sh        # Auto-scaling demonstration
./scripts/demo-canary.sh             # Canary deployments
./scripts/demo-multitenancy.sh       # Multi-tenant isolation
./scripts/demo-observability.sh      # Monitoring & observability

# Testing
./scripts/test-ci-locally.sh         # Run CI tests locally
```

### Cleanup & Maintenance
```bash
# Clean up platform
./scripts/cleanup.sh

# Get JWT tokens for testing
./scripts/get-jwt-tokens.sh
```

### Access URLs (after bootstrap)
- **AI Gateway**: http://localhost:8080 (Primary entry point)
- **Grafana**: http://localhost:3000 (admin/prom-operator)
- **Prometheus**: http://localhost:9090
- **Kiali**: http://localhost:20001
- **Management UI**: http://localhost:8085 (via port-forward)

## Version Management
All component versions are explicitly defined in `scripts/bootstrap.sh` for controlled upgrades and consistent deployments.