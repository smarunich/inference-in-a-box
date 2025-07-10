# Management API Examples

This directory contains examples for using the Management API to manage AI/ML models in the inference platform.

## Authentication

First, get a JWT token:

```bash
# Get tokens for all tenants
curl http://localhost:8082/api/tokens

# Example response:
{
  "tenant-a": "eyJhbGciOiJS...",
  "tenant-b": "eyJhbGciOiJS...",
  "tenant-c": "eyJhbGciOiJS..."
}
```

## Model Management

### List Models

```bash
# List all models for authenticated tenant
curl -H "Authorization: Bearer <token>" \
     http://localhost:8082/api/models
```

### Get Model Details

```bash
# Get specific model details
curl -H "Authorization: Bearer <token>" \
     http://localhost:8082/api/models/sklearn-iris
```

### Create Model

```bash
# Create a new sklearn model
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "my-sklearn-model",
       "framework": "sklearn",
       "storageUri": "gs://kfserving-examples/models/sklearn/1.0/model",
       "minReplicas": 1,
       "maxReplicas": 3,
       "scaleTarget": 60
     }' \
     http://localhost:8082/api/models

# Create a TensorFlow model
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "my-tensorflow-model",
       "framework": "tensorflow",
       "storageUri": "gs://kfserving-examples/models/tensorflow/flowers",
       "minReplicas": 0,
       "maxReplicas": 5,
       "scaleTarget": 100
     }' \
     http://localhost:8082/api/models
```

### Update Model

```bash
# Update model scaling configuration
curl -X PUT \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "minReplicas": 2,
       "maxReplicas": 10,
       "scaleTarget": 80
     }' \
     http://localhost:8082/api/models/my-sklearn-model
```

### Delete Model

```bash
# Delete a model
curl -X DELETE \
     -H "Authorization: Bearer <token>" \
     http://localhost:8082/api/models/my-sklearn-model
```

## Model Inference

### Make Predictions

```bash
# Make prediction with sklearn iris model
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "instances": [
         [6.8, 2.8, 4.8, 1.4],
         [6.0, 3.4, 4.5, 1.6]
       ]
     }' \
     http://localhost:8082/api/models/sklearn-iris/predict

# Make prediction with TensorFlow model
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "instances": [
         {"b64": "iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAAAAABXZoBIAAAAw0lEQVR4nGNgGFQAB..."}
       ]
     }' \
     http://localhost:8082/api/models/tensorflow-flowers/predict
```

## Monitoring

### Get Model Logs

```bash
# Get recent logs for a model
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8082/api/models/sklearn-iris/logs?lines=50"
```

### Get Tenant Information

```bash
# Get information about the authenticated tenant
curl -H "Authorization: Bearer <token>" \
     http://localhost:8082/api/tenant
```

## Supported Frameworks

```bash
# List all supported ML frameworks
curl http://localhost:8082/api/frameworks
```

## Port Forwarding

To access the Management API locally:

```bash
# Port forward to Management API
kubectl port-forward -n default svc/management-api 8082:8082
```

## Complete Example Script

Here's a complete example that demonstrates the full workflow:

```bash
#!/bin/bash

# Set the API endpoint
API_URL="http://localhost:8082"

# Get JWT token for tenant-a
TOKEN=$(curl -s ${API_URL}/api/tokens | jq -r '.["tenant-a"]')

echo "Using token for tenant-a: ${TOKEN:0:50}..."

# Create a new model
echo "Creating new sklearn model..."
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "demo-sklearn-model",
       "framework": "sklearn",
       "storageUri": "gs://kfserving-examples/models/sklearn/1.0/model",
       "minReplicas": 1,
       "maxReplicas": 3
     }' \
     ${API_URL}/api/models

echo -e "\n\nWaiting for model to be ready..."
sleep 30

# Check model status
echo "Checking model status..."
curl -H "Authorization: Bearer $TOKEN" \
     ${API_URL}/api/models/demo-sklearn-model

# Make a prediction
echo -e "\n\nMaking prediction..."
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "instances": [
         [6.8, 2.8, 4.8, 1.4],
         [6.0, 3.4, 4.5, 1.6]
       ]
     }' \
     ${API_URL}/api/models/demo-sklearn-model/predict

# Get model logs
echo -e "\n\nGetting model logs..."
curl -H "Authorization: Bearer $TOKEN" \
     "${API_URL}/api/models/demo-sklearn-model/logs?lines=20"

# Clean up - delete the model
echo -e "\n\nCleaning up..."
curl -X DELETE \
     -H "Authorization: Bearer $TOKEN" \
     ${API_URL}/api/models/demo-sklearn-model
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing token)
- `403` - Forbidden (invalid token)
- `404` - Not Found (model doesn't exist)
- `500` - Internal Server Error

Error responses include details:

```json
{
  "error": "Model not found",
  "details": "inferenceservice \"nonexistent-model\" not found"
}
```