# Management Service API Reference

> **📋 Navigation:** [🏠 Main README](../README.md) • [🎯 Goals & Vision](../GOALS.md) • [🚀 Getting Started](getting-started.md) • [📖 Usage Guide](usage.md) • [🏗️ Architecture](architecture.md) • [🤖 AI Assistant](../CLAUDE.md)

The Management Service provides a comprehensive REST API for managing AI/ML model inference operations. This document provides detailed API specifications, request/response formats, and usage examples.

> **🎯 Management Goals:** The Management Service enables the operational capabilities outlined in [GOALS.md](../GOALS.md)
> **📋 Publishing Workflow:** For step-by-step publishing instructions, see [Model Publishing Guide](model-publishing-guide.md)

## Base URL

```
http://localhost:8085/api
```

## Authentication

All API endpoints require JWT authentication. Include the token in the `Authorization` header:

```bash
Authorization: Bearer <jwt-token>
```

### Admin Authentication

Admin users can access additional endpoints and perform cross-tenant operations.

#### Admin Login

**POST** `/api/admin/login`

Authenticate as an admin user and receive a JWT token.

**Request:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  http://localhost:8085/api/admin/login
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "tenant": "admin",
    "name": "Administrator",
    "subject": "admin",
    "issuer": "management-service",
    "isAdmin": true,
    "exp": 1701234567
  }
}
```

#### Using the Admin Token

Once you have the admin token, include it in all subsequent requests:

```bash
# Store the token in an environment variable
export ADMIN_TOKEN=$(curl -X POST -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  http://localhost:8085/api/admin/login | jq -r '.token')

# Use the token in API requests
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8085/api/admin/system
```

#### Complete Admin Workflow Example

```bash
#!/bin/bash

# 1. Admin login and get token
echo "Logging in as admin..."
ADMIN_TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  http://localhost:8085/api/admin/login | jq -r '.token')

if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "Login failed"
  exit 1
fi

echo "Login successful, token: ${ADMIN_TOKEN:0:20}..."

# 2. Get system information
echo "Getting system information..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8085/api/admin/system | jq .

# 3. List all tenants
echo "Listing tenants..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8085/api/admin/tenants | jq .

# 4. List all models across tenants
echo "Listing all models..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8085/api/models | jq .

# 5. List all published models
echo "Listing published models..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8085/api/published-models | jq .

# 6. Execute kubectl command
echo "Checking pod status..."
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "get pods --all-namespaces"}' \
  http://localhost:8085/api/admin/kubectl | jq -r '.result'
```

### Regular User Authentication

Regular users authenticate through the platform's JWT system. The management service validates JWT tokens from the main authentication system.

```bash
# Get user token (method depends on your auth setup)
export USER_TOKEN="your-user-jwt-token"

# Use token for user operations
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:8085/api/models
```

## Model Management API

### List Models

**GET** `/api/models`

List all models accessible to the authenticated user.

**Response:**
```json
{
  "models": [
    {
      "name": "my-model",
      "namespace": "tenant-a",
      "status": "Ready",
      "ready": true,
      "url": "http://my-model-predictor.tenant-a.svc.cluster.local/v1/models/my-model:predict",
      "predictor": {
        "framework": "sklearn",
        "storageUri": "s3://my-bucket/model"
      },
      "createdAt": "2023-12-01T10:00:00Z",
      "statusDetails": {
        "ready": true,
        "phase": "Ready",
        "conditions": [...]
      }
    }
  ]
}
```

### Create Model

**POST** `/api/models`

Create a new model deployment.

**Request:**
```json
{
  "name": "my-model",
  "framework": "sklearn",
  "storageUri": "s3://my-bucket/model",
  "minReplicas": 1,
  "maxReplicas": 10,
  "scaleTarget": 80,
  "scaleMetric": "concurrency",
  "namespace": "tenant-a"
}
```

**Response:**
```json
{
  "message": "Model created successfully",
  "name": "my-model",
  "namespace": "tenant-a",
  "config": {
    "framework": "sklearn",
    "storageUri": "s3://my-bucket/model",
    "minReplicas": 1,
    "maxReplicas": 10,
    "scaleTarget": 80,
    "scaleMetric": "concurrency"
  }
}
```

### Get Model

**GET** `/api/models/{name}`

Get detailed information about a specific model.

**Response:**
```json
{
  "name": "my-model",
  "namespace": "tenant-a",
  "status": "Ready",
  "ready": true,
  "url": "http://my-model-predictor.tenant-a.svc.cluster.local/v1/models/my-model:predict",
  "predictor": {
    "framework": "sklearn",
    "storageUri": "s3://my-bucket/model"
  },
  "createdAt": "2023-12-01T10:00:00Z",
  "statusDetails": {
    "ready": true,
    "phase": "Ready",
    "replicas": {
      "desired": 1,
      "ready": 1,
      "total": 1
    },
    "conditions": [
      {
        "type": "Ready",
        "status": "True",
        "reason": "ModelReady",
        "message": "Model is ready for inference"
      }
    ]
  }
}
```

### Update Model

**PUT** `/api/models/{name}`

Update model configuration.

**Request:**
```json
{
  "minReplicas": 2,
  "maxReplicas": 20,
  "scaleTarget": 70
}
```

### Delete Model

**DELETE** `/api/models/{name}`

Delete a model deployment.

**Response:**
```json
{
  "message": "Model deleted successfully"
}
```

### Model Prediction

**POST** `/api/models/{name}/predict`

Make prediction requests to a model.

**Request:**
```json
{
  "inputData": {
    "instances": [
      {"feature1": 1.0, "feature2": 2.0}
    ]
  },
  "connectionSettings": {
    "useCustom": false
  }
}
```

**Response:**
```json
{
  "predictions": [
    {"output": 0.85}
  ]
}
```

## Model Publishing API

### Publish Model

**POST** `/api/models/{name}/publish`

Publish a model for external access with configurable hostname and rate limiting.

**Request:**
```json
{
  "config": {
    "tenantId": "tenant-a",
    "modelType": "traditional",
    "externalPath": "/models/my-model",
    "publicHostname": "api.router.inference-in-a-box",
    "rateLimiting": {
      "requestsPerMinute": 100,
      "requestsPerHour": 5000,
      "tokensPerHour": 100000,
      "burstLimit": 10
    },
    "authentication": {
      "requireApiKey": true,
      "allowedTenants": ["tenant-a", "tenant-b"]
    },
    "metadata": {
      "description": "My production model"
    }
  }
}
```

**Response:**
```json
{
  "message": "Model published successfully",
  "publishedModel": {
    "modelName": "my-model",
    "namespace": "tenant-a",
    "tenantId": "tenant-a",
    "modelType": "traditional",
    "externalUrl": "https://api.router.inference-in-a-box/models/my-model",
    "publicHostname": "api.router.inference-in-a-box",
    "apiKey": "pk_live_abc123...",
    "rateLimiting": {
      "requestsPerMinute": 100,
      "requestsPerHour": 5000,
      "tokensPerHour": 100000,
      "burstLimit": 10
    },
    "status": "active",
    "createdAt": "2023-12-01T10:00:00Z",
    "updatedAt": "2023-12-01T10:00:00Z",
    "usage": {
      "totalRequests": 0,
      "requestsToday": 0,
      "tokensUsed": 0,
      "lastAccessTime": "2023-12-01T10:00:00Z"
    },
    "documentation": {
      "endpointUrl": "https://api.router.inference-in-a-box/models/my-model",
      "authHeaders": {
        "X-API-Key": "pk_live_abc123..."
      },
      "exampleRequests": [
        {
          "method": "POST",
          "url": "https://api.router.inference-in-a-box/models/my-model/predict",
          "headers": {
            "Content-Type": "application/json",
            "X-API-Key": "pk_live_abc123..."
          },
          "body": "{\"instances\": [{\"feature1\": 1.0}]}",
          "description": "Make a prediction request"
        }
      ],
      "sdkExamples": {
        "python": "import requests\n\nresponse = requests.post(\n    'https://api.router.inference-in-a-box/models/my-model/predict',\n    headers={'X-API-Key': 'pk_live_abc123...'},\n    json={'instances': [{'feature1': 1.0}]}\n)",
        "javascript": "const response = await fetch('https://api.router.inference-in-a-box/models/my-model/predict', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'X-API-Key': 'pk_live_abc123...'\n  },\n  body: JSON.stringify({instances: [{feature1: 1.0}]})\n});",
        "curl": "curl -X POST https://api.router.inference-in-a-box/models/my-model/predict \\\n  -H 'Content-Type: application/json' \\\n  -H 'X-API-Key: pk_live_abc123...' \\\n  -d '{\"instances\": [{\"feature1\": 1.0}]}'"
      }
    }
  }
}
```

### Update Published Model

**PUT** `/api/models/{name}/publish`

Update configuration of an already published model.

**Request:**
```json
{
  "config": {
    "tenantId": "tenant-a",
    "publicHostname": "api.router.inference-in-a-box",
    "rateLimiting": {
      "requestsPerMinute": 200,
      "requestsPerHour": 10000
    }
  }
}
```

**Response:**
```json
{
  "message": "Published model updated successfully",
  "publishedModel": {
    "modelName": "my-model",
    "namespace": "tenant-a",
    "tenantId": "tenant-a",
    "modelType": "traditional",
    "externalUrl": "https://api.router.inference-in-a-box/models/my-model",
    "publicHostname": "api.router.inference-in-a-box",
    "apiKey": "pk_live_abc123...",
    "rateLimiting": {
      "requestsPerMinute": 200,
      "requestsPerHour": 10000,
      "tokensPerHour": 100000,
      "burstLimit": 10
    },
    "status": "active",
    "createdAt": "2023-12-01T10:00:00Z",
    "updatedAt": "2023-12-01T11:00:00Z",
    "usage": {
      "totalRequests": 150,
      "requestsToday": 25,
      "tokensUsed": 5000,
      "lastAccessTime": "2023-12-01T10:45:00Z"
    },
    "documentation": {
      "endpointUrl": "https://api.router.inference-in-a-box/models/my-model",
      "authHeaders": {
        "X-API-Key": "pk_live_abc123..."
      },
      "exampleRequests": [...],
      "sdkExamples": {...}
    }
  }
}
```

### Get Published Model

**GET** `/api/models/{name}/publish`

Get details of a published model.

**Query Parameters:**
- `namespace` (optional): Namespace to search in (admin only)

**Response:**
```json
{
  "modelName": "my-model",
  "namespace": "tenant-a",
  "tenantId": "tenant-a",
  "modelType": "traditional",
  "externalUrl": "https://api.router.inference-in-a-box/models/my-model",
  "publicHostname": "api.router.inference-in-a-box",
  "apiKey": "pk_live_abc123...",
  "rateLimiting": {
    "requestsPerMinute": 100,
    "requestsPerHour": 5000,
    "tokensPerHour": 100000,
    "burstLimit": 10
  },
  "status": "active",
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2023-12-01T10:00:00Z",
  "usage": {
    "totalRequests": 150,
    "requestsToday": 25,
    "tokensUsed": 5000,
    "lastAccessTime": "2023-12-01T10:45:00Z"
  },
  "documentation": {
    "endpointUrl": "https://api.router.inference-in-a-box/models/my-model",
    "authHeaders": {
      "X-API-Key": "pk_live_abc123..."
    },
    "exampleRequests": [...],
    "sdkExamples": {...}
  }
}
```

### Unpublish Model

**DELETE** `/api/models/{name}/publish`

Remove external access to a published model.

**Query Parameters:**
- `namespace` (optional): Namespace to search in (admin only)

**Response:**
```json
{
  "message": "Model unpublished successfully"
}
```

### List Published Models

**GET** `/api/published-models`

List all published models accessible to the authenticated user.

**Response:**
```json
{
  "publishedModels": [
    {
      "modelName": "my-model",
      "namespace": "tenant-a",
      "tenantId": "tenant-a",
      "modelType": "traditional",
      "externalUrl": "https://api.router.inference-in-a-box/models/my-model",
      "publicHostname": "api.router.inference-in-a-box",
      "apiKey": "pk_live_abc123...",
      "rateLimiting": {
        "requestsPerMinute": 100,
        "requestsPerHour": 5000,
        "tokensPerHour": 100000,
        "burstLimit": 10
      },
      "status": "active",
      "createdAt": "2023-12-01T10:00:00Z",
      "updatedAt": "2023-12-01T10:00:00Z",
      "usage": {
        "totalRequests": 150,
        "requestsToday": 25,
        "tokensUsed": 5000,
        "lastAccessTime": "2023-12-01T10:45:00Z"
      }
    }
  ],
  "total": 1
}
```

### Rotate API Key

**POST** `/api/models/{name}/publish/rotate-key`

Generate a new API key for a published model.

**Query Parameters:**
- `namespace` (optional): Namespace to search in (admin only)

**Response:**
```json
{
  "message": "API key rotated successfully",
  "newApiKey": "pk_live_xyz789...",
  "updatedAt": "2023-12-01T11:00:00Z"
}
```

### Validate API Key

**POST** `/api/validate-api-key`

Validate an API key (used by the gateway).

**Request:**
```json
{
  "apiKey": "pk_live_abc123..."
}
```

**Response:**
```json
{
  "valid": true,
  "tenant": "tenant-a",
  "model": "my-model"
}
```

## Admin API

### Get System Information

**GET** `/api/admin/system`

Get system-wide information (admin only).

**Response:**
```json
{
  "nodes": [
    {
      "name": "kind-control-plane",
      "status": "Ready",
      "version": "v1.28.0",
      "capacity": {
        "cpu": "8",
        "memory": "16Gi"
      },
      "allocatable": {
        "cpu": "8",
        "memory": "16Gi"
      }
    }
  ],
  "namespaces": [
    {
      "name": "tenant-a",
      "status": "Active",
      "created": "2023-12-01T09:00:00Z"
    }
  ],
  "deployments": [
    {
      "name": "my-model-predictor",
      "namespace": "tenant-a",
      "ready": 1,
      "replicas": 1,
      "available": 1
    }
  ]
}
```

### Get Tenants

**GET** `/api/admin/tenants`

Get tenant information (admin only).

**Response:**
```json
{
  "tenants": [
    {
      "name": "tenant-a",
      "status": "Active",
      "created": "2023-12-01T09:00:00Z"
    },
    {
      "name": "tenant-b",
      "status": "Active",
      "created": "2023-12-01T09:00:00Z"
    }
  ]
}
```

### Execute kubectl Command

**POST** `/api/admin/kubectl`

Execute kubectl commands (admin only).

**Request:**
```json
{
  "command": "get pods -n tenant-a"
}
```

**Response:**
```json
{
  "result": "NAME                                   READY   STATUS    RESTARTS   AGE\nmy-model-predictor-0                   1/1     Running   0          5m",
  "command": "get pods -n tenant-a"
}
```

## Error Responses

All endpoints return standardized error responses:

**400 Bad Request:**
```json
{
  "error": "Invalid request format",
  "details": "Field 'name' is required"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions for tenant: tenant-a"
}
```

**404 Not Found:**
```json
{
  "error": "Model not found"
}
```

**409 Conflict:**
```json
{
  "error": "Model is already published"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create model",
  "details": "Kubernetes API error: namespace not found"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default limits**: 100 requests per minute per user
- **Burst limit**: 10 requests per second
- **Headers**: Rate limit information is returned in response headers:
  - `X-RateLimit-Limit`: Request limit per minute
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time in seconds

## WebSocket Support

The Management Service supports WebSocket connections for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:8085/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};
```

## Configuration

The Management Service can be configured via environment variables:

- `PORT`: Server port (default: 8080)
- `KUBECONFIG`: Path to kubeconfig file
- `JWT_SECRET`: JWT signing secret
- `RATE_LIMIT_REQUESTS`: Requests per minute limit
- `CORS_ORIGINS`: Allowed CORS origins
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## Security Considerations

1. **Authentication**: Always use JWT tokens for authentication
2. **HTTPS**: Use HTTPS in production environments
3. **API Keys**: Rotate API keys regularly
4. **Rate Limiting**: Monitor and adjust rate limits based on usage
5. **Validation**: All inputs are validated and sanitized
6. **Audit Logging**: All operations are logged for audit purposes

## SDK Examples

### Python

```python
import requests
import json

class InferenceClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def publish_model(self, model_name, config):
        url = f"{self.base_url}/models/{model_name}/publish"
        response = requests.post(url, headers=self.headers, json={"config": config})
        return response.json()
    
    def update_published_model(self, model_name, config):
        url = f"{self.base_url}/models/{model_name}/publish"
        response = requests.put(url, headers=self.headers, json={"config": config})
        return response.json()
    
    def get_published_models(self):
        url = f"{self.base_url}/published-models"
        response = requests.get(url, headers=self.headers)
        return response.json()

# Usage
client = InferenceClient("http://localhost:8085/api", "your-jwt-token")
result = client.publish_model("my-model", {
    "tenantId": "tenant-a",
    "publicHostname": "api.router.inference-in-a-box",
    "rateLimiting": {
        "requestsPerMinute": 100,
        "requestsPerHour": 5000
    }
})
```

### JavaScript

```javascript
class InferenceClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  
  async publishModel(modelName, config) {
    const response = await fetch(`${this.baseUrl}/models/${modelName}/publish`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ config })
    });
    return response.json();
  }
  
  async updatePublishedModel(modelName, config) {
    const response = await fetch(`${this.baseUrl}/models/${modelName}/publish`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ config })
    });
    return response.json();
  }
  
  async getPublishedModels() {
    const response = await fetch(`${this.baseUrl}/published-models`, {
      headers: this.headers
    });
    return response.json();
  }
}

// Usage
const client = new InferenceClient('http://localhost:8085/api', 'your-jwt-token');
const result = await client.publishModel('my-model', {
  tenantId: 'tenant-a',
  publicHostname: 'api.router.inference-in-a-box',
  rateLimiting: {
    requestsPerMinute: 100,
    requestsPerHour: 5000
  }
});
```

## Support

For issues and questions:
- Check the [troubleshooting guide](../usage.md#troubleshooting)
- Review the [architecture documentation](../architecture.md)
- Submit issues to the project repository