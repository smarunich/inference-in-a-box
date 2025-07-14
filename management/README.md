# Consolidated Management Service

A monolithic service that combines the Management API and UI for the AI/ML inference platform.

## Overview

This service consolidates the previously separate Management API and UI components into a single deployment:
- **Backend**: API server
- **Frontend**: React application served as static files
- **Deployment**: Single Docker container and Kubernetes deployment

## Architecture

```
┌─────────────────────────────────────────┐
│         Management Service              │
│                                         │
│  ┌─────────────────┐  ┌─────────────────┐│
│  │   Backend API   │  │   React UI      ││
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
   go mod download
   ```

2. **Build UI**:
   ```bash
   cd ui && npm install && npm run build
   ```

3. **Start server**:
   ```bash
   go run .
   ```

4. **Development mode** (with automatic restart):
   ```bash
   # Install air for hot reload
   go install github.com/cosmtrek/air@latest
   air
   ```

### Project Structure

```
management/
├── main.go               # Main entry point
├── config.go             # Configuration management
├── types.go              # Type definitions
├── auth.go               # Authentication service
├── models.go             # Model management service
├── admin.go              # Admin service
├── k8s.go                # Kubernetes client
├── server.go             # HTTP server and routing
├── utils.go              # Utility functions
├── go.mod                # Go module dependencies
├── go.sum                # Go module checksums
├── Dockerfile            # Docker build
├── README.md             # This file
└── ui/                   # React UI (unchanged)
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
2. **Stage 2**: Build backend binary
3. **Stage 3**: Create minimal runtime image with Alpine Linux

## Kubernetes Deployment

### Registry-based Deployment (Recommended)
```bash
kubectl apply -f ../configs/management/management.yaml
```

### Access Service
```bash
kubectl port-forward svc/management-service 8085:80
```

## Scripts

### Build Scripts
- `scripts/build-management.sh` - Build and deploy backend
- `scripts/deploy-management.sh` - Deploy to Kubernetes
- `scripts/build-and-push-images.sh` - Build and push multi-arch Docker images
- `scripts/build-local-images.sh` - Build Docker images locally

### Usage
```bash
# Build and deploy
./scripts/build-management.sh

# Deploy only
./scripts/deploy-management.sh

# Build and push Docker images
./scripts/build-and-push-images.sh

# Build local Docker images
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
management-api/     → Port 8082 (Backend API)
management-ui/      → Port 80 (via Nginx)
```

### After (Consolidated Service)
```
management/         → Port 8080 (Backend + React)
```

### Benefits
- **Simplified deployment**: Single service instead of two
- **Reduced complexity**: One Docker image, one Kubernetes deployment
- **Better performance**: No network overhead between API and UI, faster backend
- **Easier maintenance**: Single codebase and deployment pipeline
- **Improved resource efficiency**: Lower memory footprint and faster startup
- **Better concurrency**: Efficient concurrent request handling

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

## Backend Migration

The backend has been refactored while maintaining 100% API compatibility:

### What Changed:
- **Performance**: Improved memory usage and startup time
- **Resource Requirements**: Reduced from 256Mi to 128Mi memory
- **Concurrency**: Better concurrent request handling

### What Stayed the Same:
- **React Frontend**: Completely unchanged
- **API Endpoints**: 100% compatible
- **Authentication**: JWT handling identical
- **Docker Deployment**: Same deployment process
- **UI Functionality**: All features work identically