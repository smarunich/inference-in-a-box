# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Inference-in-a-Box** is a comprehensive Kubernetes-based AI/ML inference platform demonstration that showcases enterprise-grade model serving using modern cloud-native technologies. It's a reference implementation for organizations deploying AI/ML models at scale with multi-tenancy, security, and observability.

## Technology Stack

- **Kubernetes**: Container orchestration via Kind (Kubernetes in Docker)
- **Istio v1.26.2**: Service mesh for security, traffic management, and observability
- **KServe v0.15.2**: Kubernetes-native serverless model serving
- **Knative v1.18.1**: Serverless framework with scale-to-zero capabilities
- **Envoy AI Gateway v0.2.1**: AI-specific gateway with JWT authentication
- **Observability**: Prometheus, Grafana, Jaeger, Kiali

## Key Commands

### Environment Setup
```bash
# Complete platform bootstrap (10-15 minutes)
./scripts/bootstrap.sh

# Interactive demo with sample scenarios
./scripts/demo.sh

# Clean up entire environment
./scripts/cleanup.sh
```

### Cluster Management
```bash
# Create Kind cluster
./scripts/clusters/create-kind-cluster.sh

# Check cluster status
kubectl cluster-info --context kind-inference-in-a-box
```

### Model Deployment
```bash
# Deploy all sample models
./scripts/models/deploy-models.sh

# Deploy specific model
kubectl apply -f configs/kserve/models/sklearn-iris.yaml
```

### Testing and Validation
```bash
# Run sample inference requests with JWT auth
./examples/inference-requests/sample-requests.sh

# Test specific tenant model
./scripts/test-inference.sh tenant-a sklearn-iris
```

### Service Access
```bash
# Port-forward to access services locally
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80                    # Grafana
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090 # Prometheus
kubectl port-forward -n monitoring svc/kiali 20001:20001                             # Kiali
kubectl port-forward -n istio-system svc/istio-ingressgateway 8080:80                # AI Gateway via Istio
kubectl port-forward -n default svc/jwt-server 8081:8080                             # JWT Server
```

## Architecture

### Multi-Tenant Design
- **Tenant Namespaces**: `tenant-a`, `tenant-b`, `tenant-c` with isolated resources
- **Security Boundaries**: Istio authorization policies and RBAC per tenant
- **Resource Governance**: Separate quotas and policies per tenant

### AI Gateway Layer
- **Envoy AI Gateway**: Primary entry point with JWT authentication
- **Intelligent Routing**: Path-based and header-based model routing  
- **Rate Limiting**: Per-tenant and global rate limiting
- **JWT Validation**: Automatic token validation with JWKS integration

### Serverless Model Serving
- **KServe InferenceServices**: Auto-scaling model endpoints with scale-to-zero
- **Supported Frameworks**: Scikit-learn, PyTorch, TensorFlow, ONNX
- **Traffic Splitting**: Canary deployments and A/B testing capabilities

### Service Mesh Security
- **Zero-Trust**: Automatic mTLS between all services
- **JWT Authentication**: JWT server with JWKS endpoint for token validation
- **Authorization Policies**: Fine-grained access control
- **Tenant Isolation**: Namespace-based security boundaries

## Key Directories

### Configuration
- `configs/envoy-gateway/` - AI Gateway configurations (GatewayClass, HTTPRoute, Security Policies)
- `configs/kserve/models/` - Model deployment configurations
- `configs/istio/` - Service mesh policies and routing rules
- `configs/auth/` - JWT server deployment and authentication
- `configs/certs/` - TLS certificate management
- `configs/observability/` - Grafana dashboards and monitoring

### Scripts
- `scripts/bootstrap.sh` - **Main deployment script**
- `scripts/demo.sh` - **Interactive demo runner**
- `scripts/clusters/` - Cluster management scripts
- `scripts/models/` - Model deployment automation
- `scripts/security/` - Security configuration scripts

### Examples
- `examples/inference-requests/` - Sample API calls with authentication
- `examples/traffic-scenarios/` - Canary and A/B testing examples
- `examples/serverless/` - Serverless configuration samples

### Models
- `models/sklearn-iris/` - Iris classification model artifacts
- `models/tensorflow-mnist/` - MNIST digit classification model
- `models/pytorch-resnet/` - ResNet image classification model

## Development Notes

- **Prerequisites**: Docker Desktop, kubectl, Kind, Helm 3.12+, curl, jq
- **Cluster Name**: `inference-in-a-box` (Kind cluster)
- **No Traditional Dependencies**: This is infrastructure-as-code, not application code
- **Shell-Driven**: All automation via bash scripts, no package managers
- **Production Patterns**: Demonstrates enterprise-grade AI/ML deployment practices

## Authentication

JWT tokens are required for model inference. A JWT server is deployed during bootstrap that provides:
- JWKS endpoint at `/.well-known/jwks.json`
- Demo tokens endpoint at `/tokens`
- Health check at `/health`

Get JWT tokens using:
```bash
./scripts/get-jwt-tokens.sh
```

Or retrieve them manually:
```bash
kubectl port-forward -n default svc/jwt-server 8081:8080 &
curl http://localhost:8081/tokens
```

## Troubleshooting

Check component status:
```bash
# Verify all pods are running
kubectl get pods --all-namespaces

# Check KServe inference services
kubectl get inferenceservices --all-namespaces

# Verify Istio configuration
istioctl analyze --all-namespaces
```