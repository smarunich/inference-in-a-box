const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 8082;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // For demo purposes, we'll validate against the existing JWT server
  // In production, you'd verify against the JWKS endpoint
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.tenant) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Utility functions
const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr });
      } else {
        resolve(stdout);
      }
    });
  });
};

const validateTenant = (tenant) => {
  return ['tenant-a', 'tenant-b', 'tenant-c'].includes(tenant);
};

const generateModelYAML = (modelName, tenant, config) => {
  const modelTemplate = {
    apiVersion: 'serving.kserve.io/v1beta1',
    kind: 'InferenceService',
    metadata: {
      name: modelName,
      namespace: tenant
    },
    spec: {
      predictor: {
        minReplicas: config.minReplicas || 1,
        maxReplicas: config.maxReplicas || 3,
        scaleTarget: config.scaleTarget || 60,
        scaleMetric: config.scaleMetric || 'concurrency',
        [config.framework]: {
          storageUri: config.storageUri
        }
      }
    }
  };

  return yaml.dump(modelTemplate);
};

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get JWT tokens (proxy to existing JWT server)
app.get('/api/tokens', async (req, res) => {
  try {
    const result = await execCommand('kubectl port-forward -n default svc/jwt-server 8081:8080 > /dev/null 2>&1 & sleep 2 && curl -s http://localhost:8081/tokens && pkill -f "kubectl port-forward.*jwt-server"');
    const tokens = JSON.parse(result);
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tokens', details: error.message });
  }
});

// List all models
app.get('/api/models', authenticateToken, async (req, res) => {
  try {
    const tenant = req.user.tenant;
    const command = `kubectl get inferenceservices -n ${tenant} -o json`;
    const result = await execCommand(command);
    const models = JSON.parse(result);
    
    const modelList = models.items.map(model => ({
      name: model.metadata.name,
      namespace: model.metadata.namespace,
      status: model.status?.conditions?.[0]?.status || 'Unknown',
      ready: model.status?.conditions?.[0]?.type === 'Ready' && model.status?.conditions?.[0]?.status === 'True',
      url: model.status?.url,
      predictor: model.spec.predictor,
      createdAt: model.metadata.creationTimestamp
    }));

    res.json({ models: modelList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list models', details: error.message });
  }
});

// Get specific model
app.get('/api/models/:modelName', authenticateToken, async (req, res) => {
  try {
    const tenant = req.user.tenant;
    const modelName = req.params.modelName;
    const command = `kubectl get inferenceservice ${modelName} -n ${tenant} -o json`;
    const result = await execCommand(command);
    const model = JSON.parse(result);
    
    const modelInfo = {
      name: model.metadata.name,
      namespace: model.metadata.namespace,
      status: model.status?.conditions?.[0]?.status || 'Unknown',
      ready: model.status?.conditions?.[0]?.type === 'Ready' && model.status?.conditions?.[0]?.status === 'True',
      url: model.status?.url,
      predictor: model.spec.predictor,
      createdAt: model.metadata.creationTimestamp,
      conditions: model.status?.conditions || []
    };

    res.json(modelInfo);
  } catch (error) {
    if (error.stderr && error.stderr.includes('not found')) {
      res.status(404).json({ error: 'Model not found' });
    } else {
      res.status(500).json({ error: 'Failed to get model', details: error.message });
    }
  }
});

// Create new model
app.post('/api/models', authenticateToken, async (req, res) => {
  try {
    const tenant = req.user.tenant;
    const { name, framework, storageUri, minReplicas, maxReplicas, scaleTarget, scaleMetric } = req.body;

    if (!name || !framework || !storageUri) {
      return res.status(400).json({ error: 'Missing required fields: name, framework, storageUri' });
    }

    const supportedFrameworks = ['sklearn', 'tensorflow', 'pytorch', 'onnx', 'xgboost'];
    if (!supportedFrameworks.includes(framework)) {
      return res.status(400).json({ error: `Unsupported framework. Supported: ${supportedFrameworks.join(', ')}` });
    }

    const config = {
      framework,
      storageUri,
      minReplicas: minReplicas || 1,
      maxReplicas: maxReplicas || 3,
      scaleTarget: scaleTarget || 60,
      scaleMetric: scaleMetric || 'concurrency'
    };

    const modelYAML = generateModelYAML(name, tenant, config);
    const tempFile = `/tmp/model-${name}-${Date.now()}.yaml`;
    
    await fs.writeFile(tempFile, modelYAML);
    
    const command = `kubectl apply -f ${tempFile}`;
    await execCommand(command);
    
    // Clean up temp file
    await fs.unlink(tempFile);

    res.status(201).json({ 
      message: 'Model created successfully',
      name,
      namespace: tenant,
      config
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create model', details: error.message });
  }
});

// Update model
app.put('/api/models/:modelName', authenticateToken, async (req, res) => {
  try {
    const tenant = req.user.tenant;
    const modelName = req.params.modelName;
    const { framework, storageUri, minReplicas, maxReplicas, scaleTarget, scaleMetric } = req.body;

    // Get existing model first
    const getCommand = `kubectl get inferenceservice ${modelName} -n ${tenant} -o json`;
    const existingModel = JSON.parse(await execCommand(getCommand));

    // Update with new values
    const config = {
      framework: framework || Object.keys(existingModel.spec.predictor).find(k => k !== 'minReplicas' && k !== 'maxReplicas' && k !== 'scaleTarget' && k !== 'scaleMetric'),
      storageUri: storageUri || existingModel.spec.predictor[framework]?.storageUri,
      minReplicas: minReplicas || existingModel.spec.predictor.minReplicas,
      maxReplicas: maxReplicas || existingModel.spec.predictor.maxReplicas,
      scaleTarget: scaleTarget || existingModel.spec.predictor.scaleTarget,
      scaleMetric: scaleMetric || existingModel.spec.predictor.scaleMetric
    };

    const modelYAML = generateModelYAML(modelName, tenant, config);
    const tempFile = `/tmp/model-${modelName}-${Date.now()}.yaml`;
    
    await fs.writeFile(tempFile, modelYAML);
    
    const command = `kubectl apply -f ${tempFile}`;
    await execCommand(command);
    
    // Clean up temp file
    await fs.unlink(tempFile);

    res.json({ 
      message: 'Model updated successfully',
      name: modelName,
      namespace: tenant,
      config
    });
  } catch (error) {
    if (error.stderr && error.stderr.includes('not found')) {
      res.status(404).json({ error: 'Model not found' });
    } else {
      res.status(500).json({ error: 'Failed to update model', details: error.message });
    }
  }
});

// Delete model
app.delete('/api/models/:modelName', authenticateToken, async (req, res) => {
  try {
    const tenant = req.user.tenant;
    const modelName = req.params.modelName;
    const command = `kubectl delete inferenceservice ${modelName} -n ${tenant}`;
    await execCommand(command);

    res.json({ message: 'Model deleted successfully', name: modelName, namespace: tenant });
  } catch (error) {
    if (error.stderr && error.stderr.includes('not found')) {
      res.status(404).json({ error: 'Model not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete model', details: error.message });
    }
  }
});

// Inference endpoint (proxy to model)
app.post('/api/models/:modelName/predict', authenticateToken, async (req, res) => {
  try {
    const tenant = req.user.tenant;
    const modelName = req.params.modelName;
    const inputData = req.body;

    // Get model URL
    const getCommand = `kubectl get inferenceservice ${modelName} -n ${tenant} -o jsonpath='{.status.url}'`;
    const modelUrl = await execCommand(getCommand);

    if (!modelUrl) {
      return res.status(404).json({ error: 'Model not ready or not found' });
    }

    // Make prediction request
    const curlCommand = `curl -s -X POST ${modelUrl}/v1/models/${modelName}:predict \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${req.headers.authorization.split(' ')[1]}" \
      -d '${JSON.stringify(inputData)}'`;
    
    const result = await execCommand(curlCommand);
    const prediction = JSON.parse(result);

    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to make prediction', details: error.message });
  }
});

// Get model logs
app.get('/api/models/:modelName/logs', authenticateToken, async (req, res) => {
  try {
    const tenant = req.user.tenant;
    const modelName = req.params.modelName;
    const lines = req.query.lines || 100;
    
    const command = `kubectl logs -n ${tenant} -l serving.kserve.io/inferenceservice=${modelName} --tail=${lines}`;
    const logs = await execCommand(command);

    res.json({ logs: logs.split('\n') });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs', details: error.message });
  }
});

// Get tenant info
app.get('/api/tenant', authenticateToken, (req, res) => {
  res.json({
    tenant: req.user.tenant,
    user: req.user.name || req.user.sub,
    issuer: req.user.iss,
    audience: req.user.aud,
    expiresAt: new Date(req.user.exp * 1000).toISOString()
  });
});

// List available frameworks
app.get('/api/frameworks', (req, res) => {
  res.json({
    frameworks: [
      { name: 'sklearn', description: 'Scikit-learn models' },
      { name: 'tensorflow', description: 'TensorFlow models' },
      { name: 'pytorch', description: 'PyTorch models' },
      { name: 'onnx', description: 'ONNX models' },
      { name: 'xgboost', description: 'XGBoost models' }
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Management API server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  GET  /api/tokens - Get JWT tokens');
  console.log('  GET  /api/models - List models');
  console.log('  GET  /api/models/:name - Get model details');
  console.log('  POST /api/models - Create model');
  console.log('  PUT  /api/models/:name - Update model');
  console.log('  DELETE /api/models/:name - Delete model');
  console.log('  POST /api/models/:name/predict - Make prediction');
  console.log('  GET  /api/models/:name/logs - Get model logs');
  console.log('  GET  /api/tenant - Get tenant info');
  console.log('  GET  /api/frameworks - List supported frameworks');
});