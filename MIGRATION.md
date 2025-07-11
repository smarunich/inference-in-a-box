# Management Service Migration

## Overview
The Management API and UI have been consolidated into a single monolithic service located at `management/`.

## Migration Details

### Before (Separate Services)
- `management-api/` - Node.js/Express API server (Port 8082)
- `management-ui/` - React frontend with Nginx (Port 80)
- `configs/management-api/` - API Kubernetes configs
- `configs/management-ui/` - UI Kubernetes configs

### After (Consolidated Service)
- `management/` - Combined Node.js server serving API and static UI (Port 8080)
- `configs/management/` - Single Kubernetes deployment config

## What Was Moved

### Source Code
- `management-api/server.js` → `management/server.js` (updated to serve static files)
- `management-ui/src/` → `management/ui/src/`
- `management-ui/public/` → `management/ui/public/`
- `management-api/package.json` + `management-ui/package.json` → `management/package.json` (merged)

### Configuration
- `configs/management-api/` + `configs/management-ui/` → `configs/management/`
- Single Dockerfile instead of two
- Single Kubernetes deployment instead of two

### Scripts
- New: `scripts/build-management.sh` - Build and deploy consolidated service
- New: `scripts/deploy-management.sh` - Deploy consolidated service
- Updated: `scripts/build-local-images.sh` - Include consolidated service

## Benefits

1. **Simplified Deployment**: One service instead of two
2. **Reduced Complexity**: Single Docker image and Kubernetes deployment
3. **Better Performance**: No network overhead between API and UI
4. **Easier Maintenance**: Single codebase and deployment pipeline
5. **Resource Efficiency**: Fewer pods and services to manage

## Migration Date
$(date '+%Y-%m-%d %H:%M:%S')

## Old Directories
The following directories contain the original separate services and are kept for reference:
- `management-api/` - Original API service
- `management-ui/` - Original UI service
- `configs/management-api/` - Original API configs
- `configs/management-ui/` - Original UI configs

These can be removed once the consolidated service is validated and deployed successfully.