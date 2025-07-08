# Inference-in-a-Box: Usage Guide

This document provides instructions on how to use the Inference-in-a-Box platform after it has been installed.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Accessing Services](#accessing-services)
- [Making Inference Requests](#making-inference-requests)
- [Multi-tenant Operations](#multi-tenant-operations)
- [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
- [Canary Deployments](#canary-deployments)

## Prerequisites

Before using Inference-in-a-Box, ensure:

1. The platform has been successfully installed using `./scripts/bootstrap.sh`
2. You have `kubectl` installed and configured to talk to your cluster
3. You have `curl` for making API requests
4. You have `jq` for working with JSON responses

## Accessing Services

The platform exposes several services that can be accessed via port-forwarding:

### AI Gateway API

The AI Gateway is the primary entry point for model inference requests:

```bash
# Port-forward to access the AI Gateway via Istio
kubectl port-forward -n istio-system svc/istio-ingressgateway 8080:80

# API endpoint format
http://localhost:8080/v1/models/<model-name>:predict
```

### JWT Authentication

Get authentication tokens using the JWT server:

```bash
# Get all available tokens
./scripts/get-jwt-tokens.sh

# Or manually access the JWT server
kubectl port-forward -n default svc/jwt-server 8081:8080
curl http://localhost:8081/tokens
```

### Observability Tools

Access the observability stack through the following URLs:

1. **Grafana**: http://localhost:3000 (login: admin/prom-operator)
2. **Prometheus**: http://localhost:9090
3. **Kiali**: http://localhost:20001

Port-forward commands:

```bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
kubectl port-forward -n monitoring svc/kiali 20001:20001
```

## Making Inference Requests

To make inference requests to deployed models, you need a valid JWT token for the appropriate tenant.

### Getting Tokens

Use the JWT server to get valid authentication tokens:

```bash
# Get all tokens
./scripts/get-jwt-tokens.sh

# Set environment variables for convenience
export TOKEN_A="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJuYW1lIjoiVGVuYW50IEEgVXNlciIsInRlbmFudCI6InRlbmFudC1hIiwiaXNzIjoiaW5mZXJlbmNlLWluLWEtYm94IiwiYXVkIjoidGVuYW50LWEiLCJleHAiOjk5OTk5OTk5OTl9.8Xtgw_eSO-fTZexLFVXME5AQ_jJOf615P7VQGahNdDk"
export TOKEN_C="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWMiLCJuYW1lIjoiVGVuYW50IEMgVXNlciIsInRlbmFudCI6InRlbmFudC1jIiwiaXNzIjoiaW5mZXJlbmNlLWluLWEtYm94IiwiYXVkIjoidGVuYW50LWMiLCJleHAiOjk5OTk5OTk5OTl9.YGKj3n_OnUsLaJUBo-xF-_kGOOjwlwn4GWmgdP8kxQ4"
```

### Example Requests

#### Scikit-learn Iris Classification (Tenant A)

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  http://localhost:8080/v1/models/sklearn-iris:predict \
  -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}' | jq .
```

Expected response:
```json
{
  "predictions": [0],
  "model_name": "sklearn-iris",
  "model_version": "1"
}
```

#### TensorFlow MNIST Classification (Tenant B)

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIiLCJuYW1lIjoiVGVuYW50IEIgVXNlciIsInRlbmFudCI6InRlbmFudC1iIn0.xYKzRQIxgFcQguz4sBDt1M6ZaRPFBEPjjOvpwfEKjaE" \
  http://localhost:8080/v2/models/tensorflow-mnist/infer \
  -d '{"instances": [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]}' | jq .
```

### Test Script

For convenience, a script with sample requests is provided:

```bash
./examples/inference-requests/sample-requests.sh
```

## Multi-tenant Operations

Inference-in-a-Box supports multiple tenants with isolated resources:

### Tenant Namespaces

- **Tenant A**: `tenant-a` namespace with scikit-learn model
- **Tenant B**: `tenant-b` namespace with TensorFlow model
- **Tenant C**: `tenant-c` namespace with PyTorch model

### Tenant Isolation

Tenants are isolated with:
- Namespace-level resource quotas
- Network policies preventing cross-namespace traffic
- Istio authorization policies
- JWT-based authentication

To deploy a model to a specific tenant:

```bash
kubectl apply -f configs/kserve/models/my-new-model.yaml -n tenant-a
```

## Monitoring and Troubleshooting

### Monitoring Dashboards

1. **KServe Model Performance Dashboard**: Available in Grafana, shows model latency, request rate, and resource usage
2. **Istio Service Dashboard**: Shows service mesh metrics
3. **Kiali Graph**: Visual representation of service mesh traffic
4. **Jaeger Traces**: Available in Jaeger, shows distributed tracing data

### Common Troubleshooting Commands

Check model deployment status:
```bash
kubectl get inferenceservice -A
```

Check pods for a specific model:
```bash
kubectl get pods -n <tenant-namespace> -l serving.kserve.io/inferenceservice=<model-name>
```

Check model logs:
```bash
kubectl logs -n <tenant-namespace> -l serving.kserve.io/inferenceservice=<model-name> -c kserve-container
```

View Istio virtual services:
```bash
kubectl get virtualservices -A
```

## Canary Deployments

The platform supports canary deployments for model upgrades.

### Creating a Canary Deployment

1. Deploy the canary version:
```bash
kubectl apply -f examples/traffic-scenarios/canary-deployment.yaml
```

2. Test with specific requests to see traffic split.

3. Promote canary to 100% traffic (if satisfied):
```bash
kubectl apply -f examples/traffic-scenarios/canary-promotion.yaml
```

4. Alternatively, roll back by removing the canary:
```bash
kubectl delete inferenceservice <model-name>-v2 -n <tenant-namespace>
kubectl apply -f configs/istio/virtual-services/tenant-models.yaml
```
