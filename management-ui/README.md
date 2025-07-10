# Management UI

React-based web interface for managing AI/ML models in the inference platform.

## Features

- **Authentication**: JWT-based login with tenant selection
- **Model Management**: Create, edit, delete, and monitor models
- **Inference Testing**: Interactive interface to test model predictions
- **Real-time Status**: Live updates on model health and availability
- **Responsive Design**: Works on desktop and mobile devices

## Development

### Prerequisites

- Node.js 18+ 
- npm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Environment Variables

- `REACT_APP_API_URL`: Management API URL (default: "/api")

## Docker Build

### Local Build

```bash
# Build for local testing
docker build -t management-ui:latest .

# Run locally
docker run -p 8083:80 management-ui:latest
```

### Multi-Architecture Build

```bash
# Build for AMD64 and ARM64
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t us-east1-docker.pkg.dev/dogfood-cx/registryrepository/management-ui:latest \
    --push .
```

## Usage

1. **Login**: Select a tenant to authenticate
2. **Models Tab**: View and manage existing models
3. **Create Model Tab**: Deploy new models
4. **Test Inference Tab**: Test model predictions

## API Integration

The UI communicates with the Management API through:

- Authentication: JWT tokens from `/api/tokens`
- Model operations: CRUD operations on `/api/models`
- Inference: POST requests to `/api/models/:name/predict`
- Monitoring: Logs and status from `/api/models/:name/logs`

## Architecture

- **Frontend**: React with functional components and hooks
- **State Management**: Context API for auth and API calls
- **Styling**: Custom CSS with responsive design
- **HTTP Client**: Axios for API communication
- **Routing**: React Router for navigation