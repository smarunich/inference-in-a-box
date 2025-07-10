# 🎭 Inference-in-a-Box Demo Guide

This guide provides step-by-step instructions for running interactive demonstrations of the Inference-in-a-Box platform capabilities.

## 📋 Prerequisites

Before running the demos, ensure:
- Platform is bootstrapped: `./scripts/bootstrap.sh`
- All models are deployed and ready
- Required observability tools are running

## 🚀 Quick Start

```bash
# Run the interactive demo menu
./scripts/demo.sh

# Or run specific demos directly
./scripts/demo.sh --demo security
./scripts/demo.sh --demo autoscaling
./scripts/demo.sh --demo canary
./scripts/demo.sh --demo multitenancy
./scripts/demo.sh --demo observability
```

## 🎯 Demo Scenarios

### 1. 🔒 Security & Authentication Demo

**Demonstrates:** JWT-based authentication, tenant isolation, and zero-trust networking

**What it shows:**
- JWT token structure and validation
- Tenant-specific access control
- Cross-tenant access prevention
- mTLS communication between services

**Demo Flow:**
1. Displays JWT token contents for different tenants
2. Makes authorized request to sklearn-iris model with correct tenant token
3. Attempts unauthorized cross-tenant access (should fail)
4. Shows security policies in action

**Expected Outcome:**
- ✅ Tenant A can access sklearn-iris model
- ❌ Tenant A cannot access Tenant B resources
- 🔒 All communication is encrypted with mTLS

### 2. ⚡ Auto-scaling Demo

**Demonstrates:** Serverless model serving with scale-to-zero and auto-scaling

**What it shows:**
- Scale from zero pods to multiple replicas
- Load-based scaling decisions
- Scale-down after load removal
- Knative Serving integration

**Demo Flow:**
1. Shows initial pod state (likely zero pods)
2. Generates sustained load for 60 seconds
3. Monitors pod scaling events in real-time
4. Observes scale-down after load stops

**Expected Outcome:**
- 📈 Pods scale up from 0 to N based on load
- ⚡ Fast response times during scaling
- 📉 Automatic scale-down after load removal

### 3. 🚦 Canary Deployment Demo

**Demonstrates:** Advanced traffic management and progressive deployment

**What it shows:**
- Canary deployment creation
- Traffic splitting between versions
- Istio virtual service configuration
- Progressive rollout capabilities

**Demo Flow:**
1. Checks for existing sklearn-iris model
2. Deploys canary version (v2) with 10% traffic
3. Configures Istio virtual service for traffic splitting
4. Makes multiple requests to demonstrate traffic distribution
5. Shows promotion options

**Expected Outcome:**
- 🔄 90% traffic to main version, 10% to canary
- 📊 Visible traffic distribution in responses
- 🎛️ Easy promotion/rollback options

### 4. 🌐 Multi-tenant Isolation Demo

**Demonstrates:** Secure multi-tenancy with resource isolation

**What it shows:**
- Namespace-based tenant separation
- Network policies for isolation
- Resource quotas and limits
- Independent model deployments

**Demo Flow:**
1. Lists all tenant namespaces and labels
2. Shows network policies enforcing isolation
3. Displays resource quotas per tenant
4. Lists models deployed in each tenant

**Expected Outcome:**
- 🏢 Clear tenant boundaries
- 🔒 Network isolation between tenants
- 📊 Resource governance in place
- 🎯 Independent model lifecycles

### 5. 📊 Observability Demo

**Demonstrates:** Comprehensive monitoring and observability

**What it shows:**
- Real-time metrics collection
- Distributed tracing (when available)
- Service mesh visualization
- Custom dashboards

**Demo Flow:**
1. Starts port-forwarding for observability tools
2. Generates sample traffic for metrics
3. Provides access URLs for tools
4. Shows recommended dashboards

**Expected Outcome:**
- 📈 Live metrics in Prometheus
- 📊 Rich dashboards in Grafana
- 🗺️ Service topology in Kiali
- 🔍 Request traces (if Jaeger deployed)

## 🔧 Current Configuration

### AI Gateway Access
- **Envoy AI Gateway**: `http://localhost:8080` (via Istio Gateway port-forward)
- **JWT Server**: `http://localhost:8081` (for token retrieval)
- **Model Endpoints**: Use hostname-based routing (e.g., `http://sklearn-iris-predictor.tenant-a.127.0.0.1.sslip.io:8080`)
- **JWT Tokens**: Dynamically retrieved from server during demos

### Deployed Models
- **sklearn-iris** (tenant-a): Iris classification model
- **pytorch-resnet** (tenant-c): ResNet image classification model

### Observability Stack
- **Grafana**: `http://localhost:3000` (admin/prom-operator)
- **Prometheus**: `http://localhost:9090`
- **Kiali**: `http://localhost:20001`

### Tenant Structure
- **tenant-a**: Scikit-learn models
- **tenant-b**: Reserved for TensorFlow models
- **tenant-c**: PyTorch models

## 🛠️ Demo Script Features

### Interactive Menu System
```
🚀 Inference-in-a-Box Demo Menu

1) 🔒 Security & Authentication Demo
2) ⚡ Auto-scaling Demo
3) 🚦 Canary Deployment Demo
4) 🌐 Multi-tenant Isolation Demo
5) 📊 Observability Demo
6) 🧪 Run All Demos
7) 🚪 Exit
```

### Automated Setup
- Port-forwarding for required services
- Model deployment validation
- Service readiness checks
- Cleanup on exit

### Error Handling
- Graceful fallbacks for missing components
- Informative error messages
- Automatic retries where appropriate
- Clean exit handling

## 📱 Usage Examples

### Run Security Demo
```bash
./scripts/demo.sh
# Select option 1
```

### Generate Load for Auto-scaling
```bash
# The demo automatically generates load
# Watch scaling in real-time:
watch "kubectl get pods -n tenant-a -l serving.kserve.io/inferenceservice=sklearn-iris"
```

### Monitor Traffic Split
```bash
# During canary demo, monitor virtual service:
kubectl get virtualservice -n tenant-a -o yaml
```

### Access Observability Tools
```bash
# Tools are automatically port-forwarded during demo
# Access at:
# - Grafana: http://localhost:3000
# - Prometheus: http://localhost:9090
# - Kiali: http://localhost:20001
```

## 🔍 Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Kill existing port-forwards
pkill -f "port-forward"
```

**Model not ready:**
```bash
# Check model status
kubectl get inferenceservice --all-namespaces
kubectl describe inferenceservice sklearn-iris -n tenant-a
```

**Authentication failures:**
```bash
# Verify JWT tokens are valid
echo "TOKEN" | cut -d "." -f2 | base64 -d | jq .
```

### Validation Commands

```bash
# Check platform health
kubectl get pods --all-namespaces
kubectl get inferenceservice --all-namespaces

# Verify observability stack
kubectl get pods -n monitoring
kubectl get svc -n monitoring

# Test model access
curl -H "Authorization: Bearer TOKEN" \
  http://sklearn-iris-predictor.tenant-a.127.0.0.1.sslip.io:8080/v1/models/sklearn-iris:predict \
  -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}'
```

## 🎬 Demo Script Architecture

The demo system is now split into separate files for better maintainability:
- **`scripts/demo.sh`** - Main entry point with interactive menu
- **`scripts/demo-security.sh`** - Security & authentication demo
- **`scripts/demo-autoscaling.sh`** - Auto-scaling demo
- **`scripts/demo-canary.sh`** - Canary deployment demo
- **`scripts/demo-multitenancy.sh`** - Multi-tenant isolation demo
- **`scripts/demo-observability.sh`** - Observability demo

### Key Features:
- **Modular design** with separate scripts for each demo
- **Interactive menu system** for user-friendly navigation
- **Automated cleanup** to prevent resource conflicts
- **Comprehensive logging** for debugging and monitoring
- **Error handling** with graceful fallbacks
- **Correct URL patterns** using hostname-based routing

## 📖 Related Documentation

- [README.md](README.md) - Platform overview and quick start
- [CLAUDE.md](CLAUDE.md) - Development and operational guidance
- [Architecture Documentation](docs/architecture.md) - Technical deep dive
- [Troubleshooting Guide](docs/troubleshooting.md) - Common issues and solutions

## 🤝 Contributing

To add new demo scenarios:
1. Create a new `scripts/demo-<name>.sh` file following the existing patterns
2. Add a new function in `scripts/demo.sh` that calls your script
3. Add menu option in the `main()` function
4. Update this documentation
5. Test thoroughly across different environments

### Demo Script Template:
```bash
#!/bin/bash
# <Demo Name> Demo
# Description of what this demo shows

set -e

# Include common functions and logging
# ... (see existing demo scripts for patterns)

# Main demo function
demo_<name>() {
    log "Running <Demo Name> Demo"
    # Your demo logic here
    success "<Demo Name> Demo completed"
}

# Run the demo
demo_<name>
```

## 🏁 Conclusion

The Inference-in-a-Box demo showcases enterprise-grade AI/ML infrastructure capabilities through interactive, hands-on scenarios. Each demo is designed to highlight specific aspects of the platform while providing practical experience with real-world use cases.