# Consolidated Management Service

A monolithic service that combines the Management API and UI for the AI/ML inference platform.

## Overview

This service consolidates the previously separate Management API and UI components into a single deployment:
- **Backend**: Node.js/Express API server
- **Frontend**: React application served as static files
- **Deployment**: Single Docker container and Kubernetes deployment

## Architecture

```
┌─────────────────────────────────────────┐
│         Management Service              │
│                                         │
│  ┌─────────────────┐  ┌─────────────────┐│
│  │   Express API   │  │   React UI      ││
│  │                 │  │   (static)      ││
│  │  • /api/*       │  │  • /*           ││
│  │  • Authentication│  │  • Dashboard    ││
│  │  • Model CRUD   │  │  • Model Forms  ││
│  │  • Inference    │  │  • Testing      ││
│  └─────────────────┘  └─────────────────┘│
│                                         │
│         Port 8080                       │
└─────────────────────────────────────────┘
```

## Features

### API Endpoints
- `GET /health` - Health check
- `GET /api/tokens` - Get JWT tokens
- `GET /api/models` - List models
- `POST /api/models` - Create model
- `PUT /api/models/:name` - Update model
- `DELETE /api/models/:name` - Delete model
- `POST /api/models/:name/predict` - Make predictions
- `GET /api/models/:name/logs` - Get model logs
- `GET /api/tenant` - Get tenant info
- `GET /api/frameworks` - List supported frameworks

### Web Interface
- **Dashboard**: Tabbed interface for model management
- **Model List**: CRUD operations with real-time status
- **Model Form**: Create/edit models with framework selection
- **Inference Testing**: Interactive testing interface
- **Authentication**: JWT-based login with tenant selection

## Development

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build UI**:
   ```bash
   npm run build:ui
   ```

3. **Start server**:
   ```bash
   npm start
   ```

4. **Development mode**:
   ```bash
   npm run dev
   ```

### Project Structure

```
management/
├── server.js              # Main server file
├── package.json           # Dependencies
├── Dockerfile            # Docker build
├── README.md             # This file
└── ui/                   # React UI
    ├── package.json      # UI dependencies
    ├── public/           # Static assets
    │   ├── index.html
    │   └── manifest.json
    └── src/              # React source
        ├── App.js
        ├── index.js
        ├── index.css
        ├── components/   # React components
        │   ├── Dashboard.js
        │   ├── Login.js
        │   ├── ModelList.js
        │   ├── ModelForm.js
        │   └── InferenceTest.js
        └── contexts/     # React contexts
            ├── AuthContext.js
            └── ApiContext.js
```

## Docker Build

### Build Image
```bash
docker build -t management-service:latest .
```

### Run Container
```bash
docker run -d -p 8080:8080 --name management-service management-service:latest
```

### Multi-stage Build
The Dockerfile uses a multi-stage build:
1. **Stage 1**: Build React UI with Node.js
2. **Stage 2**: Setup Node.js server and copy built UI

## Kubernetes Deployment

### ConfigMap-based Deployment
```bash
kubectl apply -f ../configs/management/management.yaml
```

### Registry-based Deployment
```bash
kubectl apply -f ../configs/management/management-registry.yaml
```

### Access Service
```bash
kubectl port-forward svc/management-service 8085:80
```

## Scripts

### Build Scripts
- `scripts/build-management.sh` - Build and deploy with ConfigMaps
- `scripts/deploy-management.sh` - Deploy to Kubernetes
- `scripts/build-local-images.sh` - Build Docker images locally

### Usage
```bash
# Build and deploy
./scripts/build-management.sh

# Deploy only
./scripts/deploy-management.sh

# Deploy with registry image
./scripts/deploy-management.sh registry

# Build Docker images
./scripts/build-local-images.sh
```

## Environment Variables

- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (production/development)

## Authentication

The service uses JWT tokens for authentication:
- Tokens are validated for each API request
- Tenant information is extracted from JWT claims
- Multi-tenant isolation is enforced

## Migration from Separate Services

This consolidated service replaces the separate `management-api` and `management-ui` services:

### Before (Separate Services)
```
management-api/     → Port 8082
management-ui/      → Port 80 (via Nginx)
```

### After (Consolidated Service)
```
management/         → Port 8080 (API + UI)
```

### Benefits
- **Simplified deployment**: Single service instead of two
- **Reduced complexity**: One Docker image, one Kubernetes deployment
- **Better performance**: No network overhead between API and UI
- **Easier maintenance**: Single codebase and deployment pipeline

## Security

- JWT-based authentication
- RBAC for Kubernetes access
- Non-root container user
- Health checks and resource limits
- CORS configuration for API access

## Monitoring

- Health endpoint: `/health`
- Kubernetes liveness/readiness probes
- Resource monitoring and limits
- Logging to stdout/stderr

## Troubleshooting

### Common Issues

1. **Service not starting**:
   ```bash
   kubectl logs deployment/management-service
   ```

2. **UI not loading**:
   - Check if UI build artifacts are present
   - Verify port-forward is active
   - Check browser console for errors

3. **API not responding**:
   - Check authentication tokens
   - Verify Kubernetes RBAC permissions
   - Check service endpoints

### Debug Commands
```bash
# Check deployment status
kubectl get deployment management-service

# View logs
kubectl logs -f deployment/management-service

# Check service endpoints
kubectl get endpoints management-service

# Port forward for local access
kubectl port-forward svc/management-service 8085:80

# Check health
curl http://localhost:8085/health
```