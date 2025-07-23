# Model Publishing Guide

> **📋 Navigation:** [🏠 Main README](../README.md) • [🎯 Goals & Vision](../GOALS.md) • [🚀 Getting Started](getting-started.md) • [📖 Usage Guide](usage.md) • [🏗️ Architecture](architecture.md) • [🤖 AI Assistant](../CLAUDE.md)

This guide provides comprehensive instructions for publishing and managing AI/ML models using the inference-in-a-box Management Service.

> **🎯 Publishing Goals:** Model publishing enables external access to AI/ML models as described in [GOALS.md](../GOALS.md)
> **🔧 API Reference:** For complete API documentation, see [Management Service API](management-service-api.md)

## Overview

The Model Publishing system allows you to expose your KServe models for external access through a configurable public hostname with built-in security, rate limiting, and monitoring capabilities.

## Key Features

- **🌐 Public Hostname Configuration**: Configure custom hostnames for external access
- **🔐 API Key Authentication**: Secure access with automatically generated API keys
- **⚡ Rate Limiting**: Configurable request and token-based rate limiting
- **🔄 Dynamic Updates**: Modify published model configurations without republishing
- **📊 Usage Monitoring**: Track requests, tokens, and usage statistics
- **🏢 Multi-Tenant Support**: Isolated model publishing per tenant

## Publishing Workflow

### Step 1: Deploy Your Model

First, ensure your model is deployed and ready in the cluster:

```bash
# Check model status
kubectl get inferenceservices -n tenant-a

# Verify model is ready
kubectl get inferenceservice my-model -n tenant-a -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
```

### Step 2: Access the Management Service

```bash
# Port forward to access the Management Service
kubectl port-forward svc/management-service 8085:80

# Access the web interface
open http://localhost:8085
```

### Step 3: Publish Your Model

#### Option A: Using the Web Interface

1. **Navigate to Models Tab**: Open the Management Service UI and go to the Models section
2. **Find Your Model**: Locate your deployed model in the list
3. **Click Publish**: Click the "Publish" button next to your model
4. **Configure Publishing Settings**:
   - **Public Hostname**: Set to `api.router.inference-in-a-box` (or your custom domain)
   - **External Path**: Configure the URL path (e.g., `/models/my-model`)
   - **Rate Limiting**: Set requests per minute/hour limits
   - **Model Type**: Choose between Traditional or OpenAI-compatible
5. **Submit**: Click "Publish" to make your model externally accessible

#### Option B: Using the API

```bash
# Get JWT token first
export TOKEN=$(curl -X POST -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  http://localhost:8085/api/admin/login | jq -r '.token')

# Publish model
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "tenantId": "tenant-a",
      "publicHostname": "api.router.inference-in-a-box",
      "externalPath": "/models/my-model",
      "rateLimiting": {
        "requestsPerMinute": 100,
        "requestsPerHour": 5000,
        "tokensPerHour": 100000,
        "burstLimit": 10
      },
      "authentication": {
        "requireApiKey": true,
        "allowedTenants": ["tenant-a"]
      }
    }
  }' \
  http://localhost:8085/api/models/my-model/publish
```

## Configuration Options

### Public Hostname Configuration

The `publicHostname` field determines where your model will be accessible:

```json
{
  "publicHostname": "api.router.inference-in-a-box"
}
```

This creates external URLs like:
- Traditional models: `https://api.router.inference-in-a-box/models/my-model`
- OpenAI models: `https://api.router.inference-in-a-box/v1/models/my-model`

### Rate Limiting Configuration

Fine-tune rate limiting based on your model's capacity:

```json
{
  "rateLimiting": {
    "requestsPerMinute": 100,     // Maximum requests per minute
    "requestsPerHour": 5000,      // Maximum requests per hour
    "tokensPerHour": 100000,      // Maximum tokens per hour (OpenAI models)
    "burstLimit": 10              // Maximum burst requests
  }
}
```

### Model Type Detection

The system automatically detects model types, but you can override:

```json
{
  "modelType": "traditional"  // or "openai"
}
```

**Traditional Models**: Standard ML inference with custom endpoints
**OpenAI Models**: Chat completion and embedding endpoints compatible with OpenAI API

## Managing Published Models

### View Published Models

```bash
# List all published models
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8085/api/published-models

# Get specific published model details
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8085/api/models/my-model/publish
```

### Update Published Model Configuration

You can modify published models without republishing:

```bash
# Update rate limits
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "tenantId": "tenant-a",
      "publicHostname": "api.router.inference-in-a-box",
      "rateLimiting": {
        "requestsPerMinute": 200,
        "requestsPerHour": 10000
      }
    }
  }' \
  http://localhost:8085/api/models/my-model/publish
```

### API Key Management

#### Rotate API Keys

```bash
# Rotate API key for security
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8085/api/models/my-model/publish/rotate-key
```

#### Get API Key

The API key is returned when you publish or get model details:

```bash
# Get published model details including API key
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8085/api/models/my-model/publish | jq '.apiKey'
```

## External Access

### Using Your Published Model

Once published, your model is accessible via the configured hostname:

```bash
# Traditional model inference
curl -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instances": [{"feature1": 1.0, "feature2": 2.0}]}' \
  https://api.router.inference-in-a-box/models/my-model/predict

# OpenAI-compatible model
curl -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello!"}]
  }' \
  https://api.router.inference-in-a-box/v1/chat/completions
```

### SDK Integration

#### Python

```python
import requests

class ModelClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }
    
    def predict(self, model_name, data):
        url = f"{self.base_url}/models/{model_name}/predict"
        response = requests.post(url, headers=self.headers, json=data)
        return response.json()

# Usage
client = ModelClient(
    "https://api.router.inference-in-a-box",
    "your-api-key"
)

result = client.predict("my-model", {
    "instances": [{"feature1": 1.0, "feature2": 2.0}]
})
```

#### JavaScript

```javascript
class ModelClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
  }
  
  async predict(modelName, data) {
    const response = await fetch(`${this.baseUrl}/models/${modelName}/predict`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    return response.json();
  }
}

// Usage
const client = new ModelClient(
  'https://api.router.inference-in-a-box',
  'your-api-key'
);

const result = await client.predict('my-model', {
  instances: [{feature1: 1.0, feature2: 2.0}]
});
```

## Advanced Configuration

### Custom Domain Setup

To use a custom domain instead of `api.router.inference-in-a-box`:

1. **Update DNS**: Point your domain to the cluster's ingress IP
2. **Update TLS**: Configure SSL certificates for your domain
3. **Publish with Custom Hostname**:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "tenantId": "tenant-a",
      "publicHostname": "api.mycompany.com",
      "externalPath": "/models/my-model"
    }
  }' \
  http://localhost:8085/api/models/my-model/publish
```

### Multi-Tenant Publishing

Admin users can publish models across tenants:

```bash
# Admin publishes model for tenant-b
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "tenantId": "tenant-b",
      "publicHostname": "api.router.inference-in-a-box",
      "externalPath": "/models/tenant-b-model"
    }
  }' \
  http://localhost:8085/api/models/tenant-b-model/publish
```

### OpenAI-Compatible Models

For LLM models that support OpenAI API:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "tenantId": "tenant-a",
      "modelType": "openai",
      "publicHostname": "api.router.inference-in-a-box",
      "externalPath": "/v1/models/my-llm",
      "rateLimiting": {
        "requestsPerMinute": 50,
        "requestsPerHour": 2000,
        "tokensPerHour": 1000000
      }
    }
  }' \
  http://localhost:8085/api/models/my-llm/publish
```

## Monitoring and Observability

### Usage Statistics

Published models automatically track usage statistics:

```bash
# Get usage statistics
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8085/api/models/my-model/publish | jq '.usage'
```

Response includes:
- `totalRequests`: Total requests since publishing
- `requestsToday`: Requests in the current day
- `tokensUsed`: Total tokens consumed (OpenAI models)
- `lastAccessTime`: Timestamp of last request

### Monitoring Integration

The platform integrates with Prometheus and Grafana:

```bash
# Access Grafana dashboards
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# View model-specific metrics
# - Request rate and latency
# - Error rates
# - Token usage (OpenAI models)
# - Rate limiting triggers
```

## Security Best Practices

### 1. API Key Security

- **Rotate keys regularly**: Use the key rotation feature
- **Limit key scope**: Use tenant-specific keys when possible
- **Monitor usage**: Track unusual API key usage patterns

### 2. Rate Limiting

- **Set conservative limits**: Start with lower limits and increase based on capacity
- **Monitor burst usage**: Track burst limit triggers
- **Implement client-side rate limiting**: Respect server rate limits

### 3. Network Security

- **Use HTTPS**: Always use HTTPS for external access
- **Validate inputs**: The system validates all inputs, but implement client-side validation
- **Monitor access logs**: Review access patterns regularly

## Troubleshooting

### Common Issues

#### 1. Model Not Ready

**Problem**: Publishing fails with "Model is not ready"
**Solution**: Wait for model to be fully deployed:

```bash
kubectl get inferenceservice my-model -n tenant-a -w
```

#### 2. Rate Limit Exceeded

**Problem**: Requests return 429 Too Many Requests
**Solution**: Check and adjust rate limits:

```bash
# Check current rate limits
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8085/api/models/my-model/publish | jq '.rateLimiting'

# Update rate limits
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "tenantId": "tenant-a",
      "rateLimiting": {
        "requestsPerMinute": 200,
        "requestsPerHour": 10000
      }
    }
  }' \
  http://localhost:8085/api/models/my-model/publish
```

#### 3. Invalid API Key

**Problem**: External requests return 401 Unauthorized
**Solution**: Verify API key is correct:

```bash
# Validate API key
curl -X POST -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key"}' \
  http://localhost:8085/api/validate-api-key

# Rotate if needed
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8085/api/models/my-model/publish/rotate-key
```

#### 4. Gateway Configuration Issues

**Problem**: External URLs not accessible
**Solution**: Check gateway configuration:

```bash
# Check HTTPRoute
kubectl get httproute -n envoy-gateway-system

# Check gateway status
kubectl get gateway -n envoy-gateway-system

# Check Istio configuration
istioctl analyze --all-namespaces
```

### Debugging Commands

```bash
# Check model status
kubectl get inferenceservice -n tenant-a

# Check gateway resources
kubectl get httproute,aigatewayroute -n envoy-gateway-system

# Check rate limiting policies
kubectl get backendtrafficpolicy -n envoy-gateway-system

# View management service logs
kubectl logs -f deployment/management-service

# Check published model metadata
kubectl get configmap -n tenant-a | grep published-model
```

## Migration Guide

### From Previous Versions

If you're upgrading from a previous version without hostname configuration:

1. **Backup existing published models**:
```bash
kubectl get configmap -n tenant-a -o yaml > backup-published-models.yaml
```

2. **Update published models** with new hostname:
```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "tenantId": "tenant-a",
      "publicHostname": "api.router.inference-in-a-box"
    }
  }' \
  http://localhost:8085/api/models/my-model/publish
```

3. **Update client applications** to use new URLs

## Best Practices

### 1. Model Lifecycle Management

- **Development**: Use local hostnames for development
- **Staging**: Use staging-specific hostnames
- **Production**: Use production hostnames with proper DNS

### 2. Rate Limiting Strategy

- **Start Conservative**: Begin with lower limits
- **Monitor Usage**: Track actual usage patterns
- **Scale Gradually**: Increase limits based on capacity

### 3. Security

- **Regular Key Rotation**: Implement automated key rotation
- **Access Monitoring**: Monitor API key usage
- **Network Security**: Use HTTPS and proper firewall rules

### 4. Monitoring

- **Set up Alerts**: Configure alerts for rate limits and errors
- **Track Usage**: Monitor usage patterns and trends
- **Performance Monitoring**: Track latency and throughput

## Support

For additional help:
- Check the [API Reference](management-service-api.md)
- Review the [Architecture Guide](architecture.md)
- See the [Troubleshooting Section](usage.md#troubleshooting)
- Submit issues to the project repository