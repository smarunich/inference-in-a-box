# Project Structure & Organization

## Root Directory Layout

```
inference-in-a-box/
├── README.md                    # Main project documentation
├── MIGRATION.md                 # Migration and upgrade notes
├── demo.md                      # Demo instructions and scenarios
├── .gitignore                   # Git ignore patterns
├── .github/                     # GitHub Actions CI/CD workflows
├── .kiro/                       # Kiro AI assistant configuration
│   └── steering/                # AI assistant steering rules
├── configs/                     # Kubernetes configurations
├── docs/                        # Detailed documentation
├── examples/                    # Example configurations and scenarios
├── experiments/                 # Experimental features and tests
├── internals/                   # Internal utilities and helpers
├── management/                  # Consolidated management service
└── scripts/                     # Automation and deployment scripts
```

## Configuration Directory (`configs/`)

Organized by component and functionality:

```
configs/
├── auth/                        # Authentication configurations
│   └── jwt-server.yaml         # JWT server setup
├── certs/                       # Certificate configurations
│   └── tls-certificates.yaml   # TLS certificate management
├── envoy-gateway/              # Envoy Gateway configurations
├── istio/                      # Istio service mesh configurations
│   └── authorization/          # Authorization policies
│       └── tenant-isolation.yaml
├── kserve/                     # KServe model serving configurations
│   └── models/                 # Model deployment configurations
│       ├── huggingface-t5.yaml
│       ├── pytorch-resnet.yaml
│       └── sklearn-iris.yaml
├── management/                 # Management service configurations
│   ├── management.yaml         # Main deployment manifest
│   └── management.yaml.bak     # Backup configuration
└── observability/              # Monitoring and observability
    └── grafana-dashboards/     # Grafana dashboard definitions
        └── model-performance.json
```

## Scripts Directory (`scripts/`)

Organized by functionality and lifecycle:

```
scripts/
├── bootstrap.sh                # One-command platform setup
├── cleanup.sh                  # Platform cleanup and teardown
├── demo.sh                     # Main demo orchestrator
├── build-and-push-images.sh    # Multi-arch Docker image builds
├── build-local-images.sh       # Local Docker image builds
├── build-management.sh         # Management service build
├── deploy-management.sh        # Management service deployment
├── get-jwt-tokens.sh           # JWT token generation for testing
├── test-ci-locally.sh          # Local CI testing
├── clusters/                   # Cluster management scripts
│   ├── create-kind-cluster.sh  # Kind cluster creation
│   └── setup-networking.sh     # Network configuration
├── demo-*.sh                   # Individual demo scenarios
│   ├── demo-autoscaling.sh     # Auto-scaling demonstration
│   ├── demo-canary.sh          # Canary deployment demo
│   ├── demo-multitenancy.sh    # Multi-tenant isolation demo
│   ├── demo-observability.sh   # Observability features demo
│   └── demo-security.sh        # Security features demo
└── security/                   # Security setup scripts
    └── setup-security.sh       # Security policies and configurations
```

## Management Service Structure (`management/`)

Consolidated Go backend with embedded React frontend:

```
management/
├── main.go                     # Application entry point
├── config.go                   # Configuration management
├── types.go                    # Type definitions and structs
├── auth.go                     # JWT authentication service
├── models.go                   # Model management service
├── admin.go                    # Administrative functions
├── k8s.go                      # Kubernetes client operations
├── server.go                   # HTTP server and routing
├── utils.go                    # Utility functions
├── logging.go                  # Logging configuration
├── go.mod                      # Go module dependencies
├── go.sum                      # Go module checksums
├── package.json                # UI build configuration
├── Dockerfile                  # Multi-stage Docker build
├── .dockerignore               # Docker ignore patterns
├── README.md                   # Service-specific documentation
└── ui/                         # React frontend application
    ├── package.json            # React dependencies
    ├── public/                 # Static assets
    │   ├── index.html          # HTML template
    │   └── manifest.json       # PWA manifest
    └── src/                    # React source code
        ├── App.js              # Main application component
        ├── index.js            # React entry point
        ├── index.css           # Global styles
        ├── components/         # React components
        │   ├── Dashboard.js    # Main dashboard
        │   ├── Login.js        # Authentication component
        │   ├── ModelList.js    # Model listing and management
        │   ├── ModelForm.js    # Model creation/editing
        │   ├── InferenceTest.js # Model testing interface
        │   ├── AdminDashboard.js # Admin interface
        │   ├── AdminKubectl.js  # Kubectl interface
        │   ├── AdminLogs.js     # Log viewer
        │   ├── AdminResources.js # Resource monitoring
        │   └── AdminSystem.js   # System information
        └── contexts/           # React context providers
            ├── AuthContext.js  # Authentication state
            └── ApiContext.js   # API client context
```

## Documentation Structure (`docs/`)

```
docs/
├── architecture.md             # System architecture overview
├── getting-started.md          # Quick start guide
├── serverless.md              # Serverless features documentation
└── usage.md                   # Usage instructions and examples
```

## Examples Directory (`examples/`)

```
examples/
├── serverless/                 # Serverless deployment examples
│   └── sklearn-iris-serverless.yaml
└── traffic-scenarios/          # Traffic management examples
    ├── canary-deployment.yaml  # Canary deployment configuration
    ├── canary-promotion.yaml   # Canary promotion process
    └── sklearn-iris-canary.yaml # Canary-specific model config
```

## Naming Conventions

### Files and Directories
- **Kebab-case**: Use for file names and directory names (`sklearn-iris.yaml`, `demo-security.sh`)
- **Lowercase**: All directory names are lowercase
- **Descriptive**: File names clearly indicate their purpose and content

### Kubernetes Resources
- **Namespace Pattern**: `tenant-{a,b,c}` for multi-tenant isolation
- **Resource Names**: Use kebab-case with descriptive prefixes (`sklearn-iris`, `pytorch-resnet`)
- **Labels**: Consistent labeling for resource organization and selection

### Scripts
- **Executable**: All scripts have `.sh` extension and executable permissions
- **Prefixed**: Demo scripts use `demo-` prefix for easy identification
- **Descriptive**: Script names clearly indicate their function

## Configuration Patterns

### YAML Structure
- **Consistent indentation**: 2 spaces for YAML files
- **Resource separation**: Use `---` to separate multiple resources in single file
- **Metadata organization**: Consistent namespace, name, and label patterns

### Multi-tenant Organization
- **Namespace isolation**: Each tenant has dedicated namespace (`tenant-a`, `tenant-b`, `tenant-c`)
- **Resource naming**: Include tenant identifier in resource names where appropriate
- **Configuration separation**: Tenant-specific configurations in separate files or sections

### Environment-specific Configurations
- **Development**: Local Kind cluster configurations
- **Production**: Production-ready resource limits and security policies
- **Demo**: Optimized for demonstration and testing scenarios