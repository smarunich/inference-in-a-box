# Getting Started with Inference-in-a-Box

This guide provides step-by-step instructions to get started with Inference-in-a-Box.

## Prerequisites

Before you begin, ensure you have the following installed:

- Docker
- Kubernetes CLI (kubectl)
- Kind (Kubernetes in Docker)
- Helm
- curl
- jq

## Quick Start

1. **Clone the repository**

```bash
git clone https://github.com/your-org/inference-in-a-box.git
cd inference-in-a-box
```

2. **Bootstrap the platform**

```bash
./scripts/bootstrap.sh
```

This script will:
- Create a new Kind cluster named "inference-in-a-box"
- Install Istio service mesh (v1.26.2)
- Install Cert Manager (v1.18.1)
- Install Knative Serving (v1.14.1)
- Install KServe (v0.15.0)
- Deploy the observability stack (Prometheus v2.50.1, Grafana v10.4.0, Jaeger v1.55.0, Kiali v2.11.0)
- Configure security settings
- Deploy the Envoy AI Gateway

The entire bootstrap process takes about 10-15 minutes to complete.

3. **Setup security and multi-tenancy**

```bash
./scripts/security/setup-security.sh
```

This script will:
- Create tenant namespaces (tenant-a, tenant-b, tenant-c)
- Apply resource quotas
- Configure network policies
- Setup Istio authorization policies
- Deploy JWT authentication

4. **Deploy models**

```bash
./scripts/models/deploy-models.sh
```

This script will deploy sample models:
- scikit-learn Iris classifier (tenant-a)
- TensorFlow MNIST classifier (tenant-b)
- PyTorch ResNet model (tenant-c)

5. **Access the platform**

The bootstrap script automatically sets up port forwarding. You can access:

- **Model Inference API**: http://localhost:8080/v2/models/
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Kiali**: http://localhost:20001

## Running the Demo

To explore the platform's capabilities:

```bash
./scripts/demo.sh
```

This interactive demo script showcases:
1. Security & Authentication
2. Auto-scaling
3. Canary Deployments
4. Multi-tenant Isolation
5. Observability

## Making Inference Requests

You can send inference requests using the provided example script:

```bash
./examples/inference-requests/sample-requests.sh
```

Or manually using curl:

```bash
# Example for sklearn-iris model
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJuYW1lIjoiVGVuYW50IEEgVXNlciIsInRlbmFudCI6InRlbmFudC1hIn0.8Xtgw_eSO-fTZexLFVXME5AQ_jJOf615P7VQGahNdDk" \
  http://localhost:8080/v2/models/sklearn-iris/infer \
  -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}' | jq .
```

## Cleanup

To tear down the platform:

```bash
./scripts/cleanup.sh
```

This will:
- Delete the Kind cluster
- Clean up Docker resources
- Remove downloaded binaries

## Next Steps

After getting familiar with the platform, you may want to:

1. **Deploy your own models** - See documentation in `docs/custom-models.md`
2. **Customize security settings** - Explore options in `configs/istio/authorization/`
3. **Extend the observability stack** - Add custom Grafana dashboards or alerts
4. **Implement CI/CD pipelines** - For automated model deployment

## Additional Resources

- [Architecture Documentation](./architecture.md)
- [Usage Guide](./usage.md)
- [API Reference](./api-reference.md)

## Troubleshooting

If you encounter issues:

1. Check the logs of the failing component:
```bash
kubectl logs -n <namespace> <pod-name>
```

2. Verify all pods are running:
```bash
kubectl get pods -A
```

3. Check Istio configuration:
```bash
istioctl analyze
```
