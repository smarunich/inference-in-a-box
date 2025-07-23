# CLAUDE.md

> **📋 Navigation:** [🏠 Main README](README.md) • [🎯 Goals & Vision](GOALS.md) • [🚀 Getting Started](docs/getting-started.md) • [📖 Usage Guide](docs/usage.md) • [🏗️ Architecture](docs/architecture.md)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **🎯 Project Context:** This project demonstrates enterprise-grade AI/ML inference patterns. See [GOALS.md](GOALS.md) for complete vision and objectives.

## Project Overview

**Inference-in-a-Box** is a comprehensive Kubernetes-based AI/ML inference platform demonstration showcasing enterprise-grade model serving using cloud-native technologies. It's an infrastructure-as-code project demonstrating production-ready AI/ML deployment patterns with Envoy AI Gateway, Istio service mesh, KServe, and comprehensive observability.

## Key Commands

### Environment Setup & Bootstrap
```bash
# Complete platform bootstrap (primary deployment command)
./scripts/bootstrap.sh

# Clean up entire environment
./scripts/cleanup.sh

# Test CI/CD workflow locally (validation only, no cluster required)
./scripts/test-ci-locally.sh
```

### Cluster Management
```bash
# Create Kind cluster for local development
./scripts/clusters/create-kind-cluster.sh

# Setup networking components
./scripts/clusters/setup-networking.sh

# Check cluster status
kubectl cluster-info --context kind-inference-in-a-box
```

### Management Service (Go Backend + React Frontend)
```bash
# Build and deploy management service (Go backend with embedded React UI)
./scripts/build-management.sh

# Deploy management service to Kubernetes
./scripts/deploy-management.sh

# Development commands for React frontend
cd management && npm run build:ui      # Build React UI
cd management && npm run test:ui       # Test React UI
cd management && npm run start:ui      # Dev server for React UI

# Go backend development
cd management && go mod tidy           # Update Go dependencies
cd management && go build             # Build Go binary
cd management && go test ./...         # Run Go tests
```

### Model Publishing & Management
```bash
# Access Management Service UI for model publishing
kubectl port-forward svc/management-service 8085:80
# Open browser: http://localhost:8085

# Admin login via curl (get JWT token for API access)
export ADMIN_TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  http://localhost:8085/api/admin/login | jq -r '.token')

# Direct API access for model operations
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8085/api/models
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8085/api/published-models

# Model publishing workflow via API
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"config": {"tenantId": "tenant-a", "publicHostname": "api.router.inference-in-a-box"}}' \
  http://localhost:8085/api/models/my-model/publish

# Publish OpenAI-compatible model with token-based rate limiting
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"config": {"tenantId": "tenant-a", "publicHostname": "api.router.inference-in-a-box", "modelType": "openai", "rateLimiting": {"tokensPerHour": 100000}}}' \
  http://localhost:8085/api/models/llama-3-8b/publish

# Update published model configuration
curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"config": {"tenantId": "tenant-a", "publicHostname": "api.router.inference-in-a-box", "rateLimiting": {"requestsPerMinute": 100}}}' \
  http://localhost:8085/api/models/my-model/publish

# Admin operations
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8085/api/admin/system
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8085/api/admin/tenants
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "get pods --all-namespaces"}' \
  http://localhost:8085/api/admin/kubectl
```

### Demo & Testing
```bash
# Interactive demo with multiple scenarios
./scripts/demo.sh

# Specific demo scenarios
./scripts/demo-security.sh      # JWT authentication & authorization demo
./scripts/demo-autoscaling.sh   # Serverless auto-scaling demo  
./scripts/demo-canary.sh        # Canary deployment demo
./scripts/demo-multitenancy.sh  # Multi-tenant isolation demo
./scripts/demo-observability.sh # Monitoring & tracing demo

# Get JWT tokens for testing
./scripts/get-jwt-tokens.sh

# Test OpenAI-compatible model
export AI_GATEWAY_URL="http://localhost:8080"
export JWT_TOKEN="<your-jwt-token>"

# Chat completion request
curl -H "Authorization: Bearer $JWT_TOKEN" \
     -H "x-ai-eg-model: llama-3-8b" \
     $AI_GATEWAY_URL/v1/chat/completions \
     -d '{
       "model": "llama-3-8b",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
```

### Build & Container Management
```bash
# Build all images locally
./scripts/build-local-images.sh

# Build and push to registry
./scripts/build-and-push-images.sh

# Build multi-architecture images
./scripts/build-multiarch-images.sh
```

### Service Access (Port Forwarding)
```bash
# Management Service UI & API
kubectl port-forward svc/management-service 8085:80

# Observability Stack (see docs/usage.md for complete service access)  
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80             # Grafana
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090  # Prometheus
kubectl port-forward -n monitoring svc/kiali 20001:20001                      # Kiali

# Service Access (see docs/usage.md for complete reference)
kubectl port-forward -n envoy-gateway-system svc/envoy-ai-gateway 8080:80     # AI Gateway
kubectl port-forward svc/management-service 8085:80                           # Management UI/API
kubectl port-forward -n default svc/jwt-server 8081:8080                      # JWT Server
```

## Architecture

### Two-Tier Gateway Design
This platform implements a **dual-gateway architecture** where external traffic flows through:
1. **Tier-1: Envoy AI Gateway** - Primary entry point with JWT authentication, rate limiting, and AI-specific routing
2. **Tier-2: Istio Gateway** - Service mesh routing with mTLS encryption and traffic management

### Technology Stack Integration
- **Kind Cluster**: Local Kubernetes cluster (`inference-in-a-box`)
- **Envoy AI Gateway**: AI-specific gateway with JWT validation, model routing, and OpenAI API compatibility
  - **EnvoyExtensionPolicy**: External processor configuration for AI-specific routing
  - **Model-aware routing**: Using x-ai-eg-model header for efficient model selection
  - **Protocol translation**: OpenAI to KServe format conversion
- **Istio Service Mesh**: Zero-trust networking with automatic mTLS between services
- **KServe**: Kubernetes-native serverless model serving with auto-scaling
- **Knative**: Serverless framework enabling scale-to-zero capabilities
- **Management Service**: Go backend with embedded React frontend for platform administration
  - **Model Publishing**: Full-featured model publishing and management system
  - **Public Hostname Configuration**: Configurable external access via `api.router.inference-in-a-box`
  - **Rate Limiting**: Per-model rate limiting with configurable limits (requests and tokens)
  - **OpenAI Compatibility**: Automatic detection and configuration for LLM models
  - **Model Testing**: Interactive inference testing with support for both traditional and OpenAI formats

### Multi-Tenant Architecture
- **Tenant Namespaces**: `tenant-a`, `tenant-b`, `tenant-c` with complete resource isolation
- **Security Boundaries**: Istio authorization policies and Kubernetes RBAC per tenant
- **Resource Governance**: Separate quotas, policies, and observability scopes per tenant

### Serverless Model Serving
- **KServe InferenceServices**: Auto-scaling model endpoints with scale-to-zero capabilities
- **Supported Frameworks**: Scikit-learn, PyTorch, TensorFlow, Hugging Face transformers, vLLM, TGI
- **OpenAI-Compatible Models**: Support for chat completions, completions, and embeddings endpoints
- **Traffic Management**: Canary deployments, A/B testing, and blue-green deployment patterns

## Key Directories

### Configuration Structure
- `configs/envoy-gateway/` - AI Gateway configurations (GatewayClass, HTTPRoute, Security Policies, Rate Limiting, EnvoyExtensionPolicy)
- `configs/istio/` - Service mesh policies, authorization rules, and routing configurations
- `configs/kserve/models/` - Model deployment specifications for various ML frameworks
- `configs/auth/` - JWT server deployment and authentication configuration
- `configs/management/` - Management service deployment configuration
- `configs/observability/` - Grafana dashboards and monitoring configuration

### Root Configuration Files
- `envoydump.json` / `envoydump-latest.json` - Envoy configuration dumps for debugging
- `httproute.correct` - Sample HTTPRoute with URLRewrite and header modification filters

### Scripts Directory
- `scripts/bootstrap.sh` - **Primary deployment script** for complete platform setup
- `scripts/demo.sh` - **Interactive demo runner** with multiple scenarios
- `scripts/build-management.sh` - **Management service build and deployment**
- `scripts/clusters/` - Cluster management and networking setup scripts
- `scripts/security/` - Security configuration and policy setup scripts

### Management Service (Go + React)
- `management/` - Go backend source code with Kubernetes API integration
- `management/ui/` - React frontend for platform administration
- `management/Dockerfile` - Container image build configuration
- `management/go.mod` - Go module dependencies and version constraints
- `management/package.json` - NPM scripts for React UI development
- `management/publishing.go` - Model publishing and management service
- `management/types.go` - Type definitions including PublishConfig and PublishedModel
- `management/test_execution.go` - Test execution service for interactive model testing
- `management/ui/src/components/PublishingForm.js` - React component for model publishing
- `management/ui/src/components/PublishingList.js` - React component for managing published models  
- `management/ui/src/components/InferenceTest.js` - React component for interactive model testing
- `scripts/retest.sh` - Quick restart and port-forward for development

### Examples & Documentation
- `examples/serverless/` - Serverless configuration examples and templates
- `examples/traffic-scenarios/` - Canary and A/B testing configuration examples
- `docs/` - Architecture documentation and deployment guides

## Development Workflow

### Prerequisites
This is an infrastructure-as-code project requiring:
- Docker Desktop with Kubernetes enabled
- kubectl (Kubernetes CLI)
- Kind (Kubernetes in Docker)
- Helm 3.12+
- curl and jq for API testing

### No Traditional Package Management
This project uses shell-driven automation without traditional package managers. All dependencies are managed through:
- Helm charts for Kubernetes components
- Docker images for containerized services
- Go modules for the management service backend
- NPM for React frontend dependencies

### Authentication & Testing
JWT tokens are required for model inference requests. The platform includes a JWT server with:
- JWKS endpoint at `/.well-known/jwks.json`
- Demo tokens endpoint at `/tokens` 
- Health check at `/health`

### Common Development Patterns
- **Component verification**: `kubectl get pods --all-namespaces`
- **Service status**: `kubectl get inferenceservices --all-namespaces`
- **Istio configuration**: `istioctl analyze --all-namespaces`
- **Management service logs**: `kubectl logs -f deployment/management-service`

## Important Notes

- **Cluster Name**: All scripts assume a Kind cluster named `inference-in-a-box`
- **No Traditional Testing Framework**: This is infrastructure validation, not unit testing
- **Shell-Driven Deployment**: All automation implemented via bash scripts
- **Production Patterns**: Demonstrates enterprise-grade AI/ML deployment practices with security, observability, and multi-tenancy
- **Management Service**: Full-stack application (Go backend + React frontend) for platform administration
- **Dual-Gateway Architecture**: External traffic flows through AI Gateway first, then Istio Gateway
- **OpenAI Compatibility**: Automatic protocol translation for OpenAI → KServe format
- **Model-Aware Routing**: Use `x-ai-eg-model` header for efficient model selection
- **Token-Based Rate Limiting**: LLM models support token-based rate limiting alongside request-based limits