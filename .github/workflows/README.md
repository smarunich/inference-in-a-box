# GitHub Actions Workflows

This directory contains GitHub Actions workflows that automatically test the Inference-in-a-Box platform.

## Workflows

### 1. CI - Test Demo Platform (`ci-test-demo.yml`)

**Triggers:** 
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual workflow dispatch

**Purpose:** Comprehensive end-to-end testing of the platform including bootstrap, demo scenarios, and cleanup.

**Test Coverage:**
- ✅ Platform bootstrap and component deployment
- ✅ JWT authentication and token generation
- ✅ All demo scenarios (security, autoscaling, canary, multitenancy, observability)
- ✅ Model inference endpoint testing
- ✅ Security isolation validation
- ✅ Observability stack verification
- ✅ Complete platform cleanup

**Duration:** ~45 minutes

### 2. Nightly - Full Platform Test (`nightly-full-test.yml`)

**Triggers:**
- Scheduled: Daily at 2 AM UTC
- Manual workflow dispatch

**Purpose:** Comprehensive testing with matrix strategy covering different test scenarios.

**Test Matrix:**
- `basic-functionality`: Core platform features
- `load-testing`: Performance and scaling validation
- `security-testing`: Security controls and JWT validation
- `observability-testing`: Metrics and monitoring validation
- `failover-testing`: Resilience and recovery testing

**Duration:** ~90 minutes

### 3. PR Validation - Quick Tests (`pr-validation.yml`)

**Triggers:**
- Pull requests to `main` branch
- Manual workflow dispatch

**Purpose:** Fast validation of changes before full testing.

**Test Coverage:**
- ✅ YAML syntax validation
- ✅ Shell script syntax validation
- ✅ Kubernetes manifest validation
- ✅ Documentation completeness check
- ✅ Smoke test (basic bootstrap validation)

**Duration:** ~25 minutes

## Test Reports

### Artifacts Generated

Each workflow generates test artifacts:
- **Test Results**: Detailed reports for each test scenario
- **Platform Status**: Pod status, resource usage, events
- **Logs**: Kind cluster logs and debugging information

### Retention Policy
- CI test results: 30 days
- Nightly test results: 7 days
- PR validation results: 7 days

## Local Testing

You can run local validation before pushing changes:

```bash
# Test CI/CD workflow locally (syntax validation only)
./scripts/test-ci-locally.sh

# Test demo script CLI interface
./scripts/demo.sh --demo security
./scripts/demo.sh --demo all

# Validate YAML syntax
find . -name "*.yaml" -o -name "*.yml" -exec python3 -c "import yaml; yaml.safe_load(open('{}'))" \;

# Validate shell scripts
find . -name "*.sh" -exec bash -n {} \;
```

## Monitoring Test Results

### GitHub Actions UI
1. Go to the **Actions** tab in the GitHub repository
2. Select the workflow you want to monitor
3. Click on a specific run to see detailed logs and results

### Notifications
Workflow failures will:
- Send notifications to repository maintainers
- Block PR merges (for PR validation workflow)
- Generate detailed error reports in artifacts

## Debugging Failed Tests

### Common Issues

1. **Resource Constraints**
   - **Symptom**: Pods stuck in Pending state
   - **Solution**: Increase Kind cluster resources or reduce test load

2. **Timeout Issues**
   - **Symptom**: Tests timeout waiting for readiness
   - **Solution**: Increase timeout values or optimize component startup

3. **Network Issues**
   - **Symptom**: Port-forward failures or connection refused
   - **Solution**: Add retry logic and health checks

4. **JWT Authentication**
   - **Symptom**: 401/403 errors during inference tests
   - **Solution**: Verify JWT server deployment and token generation

### Debug Steps

1. **Check Artifacts**: Download test artifacts for detailed logs
2. **Review Pod Status**: Check pod status and events in test reports
3. **Verify Resources**: Ensure all required resources are properly deployed
4. **Check Logs**: Review component logs for error messages

## Workflow Configuration

### Environment Variables

```yaml
env:
  CLUSTER_NAME: "inference-in-a-box"
  TIMEOUT_MINUTES: 45
  KUBECTL_VERSION: "v1.28.0"
  KIND_VERSION: "v0.20.0"
  HELM_VERSION: "v3.12.0"
```

### Resource Limits

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - name: Free up disk space
        run: |
          sudo rm -rf /usr/share/dotnet
          sudo rm -rf /usr/local/lib/android
          # ... more cleanup
```

## Contributing

### Adding New Tests

1. **Create test function** in appropriate demo script
2. **Add to workflow** in relevant `.yml` file
3. **Update documentation** in this README
4. **Test locally** using `test-ci-locally.sh`

### Modifying Workflows

1. **Test changes locally** when possible
2. **Use workflow dispatch** for manual testing
3. **Monitor resource usage** to prevent CI/CD quota issues
4. **Update documentation** for any workflow changes

## Security Considerations

### Secrets Management
- No secrets are required for current workflows
- JWT tokens are generated during test execution
- All tests use ephemeral Kind clusters

### Resource Access
- Workflows run in isolated GitHub Actions runners
- No persistent storage or external service access
- All test data is generated during execution

## Performance Metrics

### Typical Test Duration
- **PR Validation**: 15-25 minutes
- **CI Demo Test**: 35-45 minutes  
- **Nightly Full Test**: 60-90 minutes

### Resource Usage
- **CPU**: 2-4 cores during peak testing
- **Memory**: 4-8 GB during Kind cluster operation
- **Disk**: 10-20 GB for container images and logs

## Troubleshooting

### Workflow Won't Start
- Check branch protection rules
- Verify workflow file syntax
- Ensure required permissions are granted

### Tests Fail Consistently
- Check for upstream dependency issues
- Verify Kubernetes version compatibility
- Review recent changes to platform configuration

### Performance Issues
- Monitor GitHub Actions quota usage
- Consider reducing test matrix size
- Optimize resource allocation in workflows

For additional support, check the main project documentation or create an issue in the repository.