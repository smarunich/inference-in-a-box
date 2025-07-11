# Multi-stage Docker build for consolidated management service
# Stage 1: Build React frontend
FROM node:18-alpine AS ui-build

# Set working directory for UI build
WORKDIR /app/ui

# Copy UI package files
COPY ui/package*.json ./
RUN npm install

# Copy UI source code
COPY ui/ ./

# Build React app
RUN npm run build

# Stage 2: Setup Node.js backend and serve static files
FROM node:18-alpine AS production

# Install kubectl (required for Kubernetes operations)
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Create app directory
WORKDIR /app

# Copy backend package files
COPY package*.json ./
RUN npm install

# Copy backend source code
COPY server.js ./

# Copy built React app from previous stage
COPY --from=ui-build /app/ui/build ./ui/build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the server
CMD ["node", "server.js"]