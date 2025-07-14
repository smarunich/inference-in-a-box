# Multi-stage Docker build for Go backend + React frontend
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

# Stage 2: Build Go backend
FROM golang:1.21-alpine AS go-build

# Install dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy Go source code
COPY *.go ./

# Build Go binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o management-service .

# Stage 3: Final runtime image
FROM alpine:latest

# Install kubectl and curl (required for Kubernetes operations)
RUN apk add --no-cache curl ca-certificates && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Create app directory
WORKDIR /app

# Copy Go binary from build stage
COPY --from=go-build /app/management-service .

# Copy built React app from UI build stage
COPY --from=ui-build /app/ui/build ./ui/build

# Create non-root user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Change ownership of the app directory
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the Go server
CMD ["./management-service"]