# Usage Guide

> **📋 Navigation:** [🏠 Main README](../README.md) • [🎯 Goals & Vision](../GOALS.md) • [🚀 Getting Started](getting-started.md) • [🏗️ Architecture](architecture.md) • [🤖 AI Assistant](../CLAUDE.md)

This guide covers how to use the Inference-in-a-Box platform after installation.

> **🚀 Getting Started:** If you haven't installed the platform yet, see [Getting Started Guide](getting-started.md)
> **🎯 Understanding Goals:** To understand what this platform achieves, read [GOALS.md](../GOALS.md)

## Prerequisites

> **📋 Installation:** Ensure you've completed the [bootstrap process](getting-started.md#clone-and-bootstrap)

Required tools:
- kubectl (configured for your cluster)
- curl and jq (for API testing)

## Accessing Services

> **⚠️ Important:** These port forwarding commands should be the canonical reference for service access.

### Core Services

#### AI Gateway (Primary Entry Point)
```bash
# Envoy AI Gateway - Main inference endpoint
kubectl port-forward -n envoy-gateway-system svc/envoy-ai-gateway 8080:80

# Test connectivity
curl http://localhost:8080/healthz
```

#### Management Service
```bash
# Web UI and REST API
kubectl port-forward svc/management-service 8085:80

# Access UI: http://localhost:8085
# API base: http://localhost:8085/api
```

#### Authentication
```bash
# JWT token server
kubectl port-forward -n default svc/jwt-server 8081:8080

# Get tokens via script (recommended)
./scripts/get-jwt-tokens.sh

# Or manually: curl http://localhost:8081/tokens
```

### Observability Stack

#### Grafana Dashboards
```bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Access: http://localhost:3000 (admin/prom-operator)
```

#### Prometheus Metrics
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Access: http://localhost:9090
```

#### Service Mesh Visualization
```bash
# Kiali service mesh graph
kubectl port-forward -n monitoring svc/kiali 20001:20001
# Access: http://localhost:20001

# Jaeger distributed tracing
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
# Access: http://localhost:16686
```

#### Istio Gateway (Tier-2)
```bash
# Service mesh gateway (internal routing)
kubectl port-forward -n istio-system svc/istio-ingressgateway 8090:80
```

## API Examples

### Authentication Setup

```bash
# Get JWT tokens for all tenants
./scripts/get-jwt-tokens.sh

# Extract specific tokens (use actual tokens from script output)
export TENANT_A_TOKEN="<tenant-a-token-from-script>"
export TENANT_B_TOKEN="<tenant-b-token-from-script>"
export TENANT_C_TOKEN="<tenant-c-token-from-script>"
```

### Traditional Model Inference

#### Scikit-learn Iris Classification (Tenant A)

```bash
curl -H "Authorization: Bearer $TENANT_A_TOKEN" \
     -H "x-ai-eg-model: sklearn-iris" \
     -H "Content-Type: application/json" \
     http://localhost:8080/v1/models/sklearn-iris:predict \
     -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}'
```

Expected response:
```json
{
  "predictions": [0],
  "model_name": "sklearn-iris",
  "model_version": "1"
}
```

#### PyTorch ResNet (Tenant C)

```bash
curl -H "Authorization: Bearer $TENANT_C_TOKEN" \
     -H "x-ai-eg-model: pytorch-resnet" \
     -H "Content-Type: application/json" \
     http://localhost:8080/v1/models/pytorch-resnet:predict \
     -d '{"instances": [[[0.1, 0.2, 0.3]]]}'
```

### OpenAI-Compatible API

For LLM models published with OpenAI compatibility:

#### Chat Completions

```bash
curl -H "Authorization: Bearer $TENANT_A_TOKEN" \
     -H "x-ai-eg-model: llama-3-8b" \
     -H "Content-Type: application/json" \
     http://localhost:8080/v1/chat/completions \
     -d '{
       "model": "llama-3-8b",
       "messages": [
         {"role": "user", "content": "Hello, how are you?"}
       ],
       "temperature": 0.7
     }'
```

#### Completions

```bash
curl -H "Authorization: Bearer $TENANT_A_TOKEN" \
     -H "x-ai-eg-model: gpt-j-6b" \
     -H "Content-Type: application/json" \
     http://localhost:8080/v1/completions \
     -d '{
       "model": "gpt-j-6b",
       "prompt": "The quick brown fox",
       "max_tokens": 50
     }'
```

### Using Management Service API

> **📘 Complete API Reference:** See [Management Service API Documentation](management-service-api.md)

```bash
# Admin login
export ADMIN_TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  http://localhost:8085/api/admin/login | jq -r '.token')

# List published models
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:8085/api/published-models
```

## Multi-Tenant Operations

> **🏗️ Architecture Details:** For comprehensive multi-tenancy architecture, see [Architecture Guide](architecture.md#multi-tenant-architecture)

### Tenant Overview

| Tenant | Namespace | Sample Model | JWT Token Claim |
|--------|-----------|--------------|-----------------|
| Tenant A | `tenant-a` | sklearn-iris | `"tenant": "tenant-a"` |
| Tenant B | `tenant-b` | tensorflow-mnist | `"tenant": "tenant-b"` |
| Tenant C | `tenant-c` | pytorch-resnet | `"tenant": "tenant-c"` |

### Deploying to Specific Tenant

```bash
# Deploy model to tenant-a namespace
kubectl apply -f my-model-config.yaml -n tenant-a

# Verify deployment
kubectl get inferenceservice -n tenant-a
```

## Monitoring & Observability

> **📊 Complete Observability Guide:** For detailed monitoring setup, see [README.md - Monitoring & Observability](../README.md#monitoring--observability)

### Available Dashboards

Access through [service URLs above](#observability-stack):

1. **Grafana**: Platform overview, model performance, business KPIs
2. **Kiali**: Service mesh visualization and traffic flow
3. **Jaeger**: Distributed tracing across inference pipeline
4. **Prometheus**: Raw metrics and alerting rules

### Quick Troubleshooting

```bash
# Check overall cluster health
kubectl get pods --all-namespaces | grep -v Running

# Verify specific model
kubectl get inferenceservice <model-name> -n <tenant-namespace>

# Check model logs
kubectl logs -l serving.kserve.io/inferenceservice=<model-name> -n <tenant-namespace>

# Analyze Istio configuration
istioctl analyze --all-namespaces
```

## Advanced Features

### Canary Deployments

> **🚦 Demo Guide:** For interactive canary deployment demo, see [demo.md](../demo.md#canary-deployment-demo)

Deploy and test traffic splitting between model versions.

### A/B Testing  

Configure intelligent traffic splitting for comparing model performance.

### Model Publishing

> **📘 Complete Publishing Guide:** See [Model Publishing Guide](model-publishing-guide.md)

Publish models for external access with rate limiting and authentication.
