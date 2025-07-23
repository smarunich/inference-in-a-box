# Getting Started with Inference-in-a-Box

> **📋 Navigation:** [🏠 Main README](../README.md) • [🎯 Goals & Vision](../GOALS.md) • [📖 Usage Guide](usage.md) • [🏗️ Architecture](architecture.md) • [🤖 AI Assistant](../CLAUDE.md)

This guide provides detailed step-by-step instructions to get the platform up and running.

> **📖 Quick Reference:** For a condensed quick start, see the [Quick Start section in README.md](../README.md#quick-start)
> **🎯 Why This Project:** To understand the goals and vision behind this platform, start with [GOALS.md](../GOALS.md)

## Prerequisites

> **📋 System Requirements:** For detailed system requirements and tool versions, see [Prerequisites in README.md](../README.md#prerequisites)

Ensure you have the following tools installed:
- Docker 20.10+ with Kubernetes enabled  
- kubectl 1.24+
- Kind 0.20+
- Helm 3.12+
- curl and jq (for API testing)

## Step-by-Step Setup

### 1. Clone and Bootstrap

```bash
# Clone the repository
git clone https://github.com/smarunich/inference-in-a-box.git
cd inference-in-a-box

# One-command bootstrap (takes 10-15 minutes)
./scripts/bootstrap.sh
```

> **🔧 What Bootstrap Does:** For detailed information about what the bootstrap script installs, see [Technology Stack](../README.md#technology-stack)

### 2. Verify Installation

```bash
# Check cluster is ready
kubectl get nodes

# Verify core components
kubectl get pods -A | grep -E "(istio|envoy|kserve|knative)"

# Check sample models are deployed
kubectl get inferenceservice -A
```

### 3. Get Authentication Tokens

```bash
# Get JWT tokens for different tenants
./scripts/get-jwt-tokens.sh

# This creates tokens for tenant-a, tenant-b, and tenant-c
export TENANT_A_TOKEN="<token-from-script>"
```

### 4. Access Services

> **🌐 Service Access:** For complete service access information and port forwarding commands, see [Usage Guide](usage.md#accessing-services)

```bash
# Access management UI
kubectl port-forward svc/management-service 8085:80
# Open browser: http://localhost:8085
```

### 5. Run Interactive Demo

> **🎭 Complete Demo Guide:** For comprehensive demo scenarios and explanations, see [demo.md](../demo.md)

```bash
# Interactive demo with multiple scenarios
./scripts/demo.sh
```

## Making Your First Inference Request

> **📝 Complete API Guide:** For detailed API usage and examples, see [Usage Guide](usage.md#api-examples)

Test the sklearn-iris model:

```bash
# Get your JWT token first
export JWT_TOKEN=$(./scripts/get-jwt-tokens.sh | grep "tenant-a" | cut -d' ' -f2)

# Make inference request
curl -H "Authorization: Bearer $JWT_TOKEN" \
     -H "x-ai-eg-model: sklearn-iris" \
     http://localhost:8080/v1/models/sklearn-iris:predict \
     -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}'
```

## Next Steps

After successful setup, explore these key areas:

### Model Publishing
> **📘 Complete Guide:** See [Model Publishing Guide](model-publishing-guide.md)

Use the Management Service to publish models for external access with rate limiting and authentication.

### Architecture Understanding  
> **🏗️ Technical Details:** See [Architecture Documentation](architecture.md)

Learn about the dual-gateway design and multi-tenant security.

### Advanced Usage
> **⚡ API Reference:** See [Management Service API](management-service-api.md)

Explore the full REST API for programmatic model management.

## Cleanup

```bash
# Complete platform teardown
./scripts/cleanup.sh
```

## Troubleshooting

> **🔧 Complete Troubleshooting:** For detailed troubleshooting steps, see [README.md - Troubleshooting](../README.md#troubleshooting)

Common verification commands:
```bash
# Check cluster health
kubectl get pods --all-namespaces | grep -v Running

# Verify AI Gateway
kubectl get pods -n envoy-gateway-system
```
