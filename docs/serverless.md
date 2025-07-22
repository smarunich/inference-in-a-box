# KServe Serverless Guide

> **📋 Navigation:** [🏠 Main README](../README.md) • [🎯 Goals & Vision](../GOALS.md) • [🚀 Getting Started](getting-started.md) • [📖 Usage Guide](usage.md) • [🏗️ Architecture](architecture.md) • [🤖 AI Assistant](../CLAUDE.md)

This guide explains how to use the serverless capabilities of KServe in the Inference-in-a-Box platform.

> **🎯 Serverless Goals:** Serverless model serving is a key capability outlined in [GOALS.md](../GOALS.md)
> **🏗️ Architecture Context:** See how serverless fits into the overall design in [Architecture Guide](architecture.md)

## Overview

Inference-in-a-Box uses KServe's Serverless deployment mode, which:
- Scales models to zero pods when not in use (saving resources)
- Automatically scales up when requests arrive
- Handles scaling based on request volume and resource usage
- Integrates with Knative and Istio for network routing

## Testing Serverless Capabilities

### Deployed Serverless Models

The bootstrap script automatically deploys serverless models:

1. **sklearn-iris** in tenant-a namespace
2. **pytorch-resnet** in tenant-c namespace

Verify the InferenceServices:

```bash
kubectl get inferenceservices --all-namespaces
```

### Observing Scale-to-Zero

1. Check the initial deployment:

```bash
kubectl get deployments -n default
```

After creation, you should see a deployment for the model.

2. Wait for scale-to-zero (about 30 seconds of no traffic):

```bash
watch kubectl get pods -n default
```

You'll see the pods terminate after the idle period.

### Test Model Inference with Cold Start

1. Port-forward the Istio gateway:

```bash
kubectl port-forward -n istio-system svc/istio-ingressgateway 8080:80
```

2. In another terminal, send a test request:

```bash
SERVICE_HOSTNAME=$(kubectl get inferenceservice sklearn-iris -n default -o jsonpath='{.status.url}' | cut -d'/' -f3)

curl -v -H "Host: ${SERVICE_HOSTNAME}" http://localhost:8080/v1/models/sklearn-iris:predict -d '{"instances": [[6.8, 2.8, 4.8, 1.4]]}'
```

3. Observe the cold start:
   - The first request will take longer as the model scales from zero
   - Subsequent requests will be faster as the pod is now running

## Key Serverless Configurations

The serverless functionality is enabled by the following configurations:

1. KServe with default deployment mode set to "Serverless":
```yaml
data:
  deploy: '{"defaultDeploymentMode":"Serverless"}'
```

2. Knative autoscaling configured for scale-to-zero:
```yaml
data:
  enable-scale-to-zero: "true"
  scale-to-zero-grace-period: "30s"
```

3. InferenceService annotations:
```yaml
annotations:
  serving.kserve.io/deploymentMode: "Serverless"
```

4. Model replica settings:
```yaml
minReplicas: 0  # Scale to zero when no traffic
maxReplicas: 3  # Max scale up to 3 replicas
```

## Monitoring Serverless Models

Monitor the scaling behavior of your models:

1. Watch pod lifecycle:
```bash
watch kubectl get pods -n <namespace>
```

2. View autoscaler metrics:
```bash
kubectl get podautoscalers.autoscaling.internal.knative.dev -n <namespace>
```

3. Check Knative services:
```bash
kubectl get ksvc -n <namespace>
```

## Customizing Serverless Behavior

To adjust serverless behavior for specific models, use annotations in the InferenceService definition:

```yaml
metadata:
  annotations:
    autoscaling.knative.dev/target: "10"  # Target 10 concurrent requests per pod
    autoscaling.knative.dev/metric: "concurrency"  # Scale based on concurrent requests
    autoscaling.knative.dev/window: "60s"  # Scaling window of 60 seconds
```

For more options, refer to the [KServe Serverless Documentation](https://kserve.github.io/website/0.15/admin/serverless/serverless/).
