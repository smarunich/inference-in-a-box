const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React app build directory
const buildPath = path.join(__dirname, 'ui', 'build');
app.use(express.static(buildPath));

// CORS - Allow frontend to access API
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

// Super admin credentials (in production, use environment variables)
const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'admin';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check for super admin token
  if (token === 'super-admin-token') {
    req.user = {
      tenant: 'admin',
      name: 'Super Admin',
      role: 'admin',
      isAdmin: true,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    return next();
  }

  // For demo purposes, we'll validate against the existing JWT server
  // In production, you'd verify against the JWKS endpoint
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.tenant) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    req.user.isAdmin = false; // Regular users are not admin
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
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

// Super admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === SUPER_ADMIN_USERNAME && password === SUPER_ADMIN_PASSWORD) {
    res.json({ 
      token: 'super-admin-token',
      user: {
        tenant: 'admin',
        name: 'Super Admin',
        role: 'admin',
        isAdmin: true
      }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
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
    let command;
    let models;
    
    if (req.user.isAdmin) {
      // Admin can see all models across all namespaces
      command = `kubectl get inferenceservices -A -o json`;
      const result = await execCommand(command);
      models = JSON.parse(result);
      console.log('API - Admin models raw data:', JSON.stringify(models, null, 2));
    } else {
      // Regular users see only their tenant models
      const tenant = req.user.tenant;
      command = `kubectl get inferenceservices -n ${tenant} -o json`;
      const result = await execCommand(command);
      models = JSON.parse(result);
      console.log(`API - Tenant ${tenant} models raw data:`, JSON.stringify(models, null, 2));
    }
    
    const modelList = models.items.map(model => {
      // Check for different condition types that indicate readiness
      const conditions = model.status?.conditions || [];
      let ready = false;
      let status = 'Unknown';
      
      // Look for Ready condition
      const readyCondition = conditions.find(c => c.type === 'Ready');
      if (readyCondition) {
        ready = readyCondition.status === 'True';
        status = readyCondition.status;
      } else {
        // Fallback: check if there's any condition with status True
        const anyTrueCondition = conditions.find(c => c.status === 'True');
        if (anyTrueCondition) {
          ready = true;
          status = 'True';
        } else if (conditions.length > 0) {
          status = conditions[0].status;
        }
      }
      
      // Additional check: if model has a URL, it's likely ready
      if (model.status?.url && !ready) {
        ready = true;
        status = 'True';
      }
      
      const processedModel = {
        name: model.metadata.name,
        namespace: model.metadata.namespace,
        status: status,
        ready: ready,
        url: model.status?.url,
        predictor: model.spec.predictor,
        createdAt: model.metadata.creationTimestamp,
        conditions: conditions // Include conditions for debugging
      };
      
      console.log(`API - Processed model ${model.metadata.name}:`, {
        ready: processedModel.ready,
        status: processedModel.status,
        hasUrl: !!processedModel.url,
        conditionsCount: conditions.length
      });
      
      return processedModel;
    });

    console.log('API - Final model list:', modelList.map(m => ({ name: m.name, ready: m.ready, status: m.status })));
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
    
    // Check for different condition types that indicate readiness
    const conditions = model.status?.conditions || [];
    let ready = false;
    let status = 'Unknown';
    
    // Look for Ready condition
    const readyCondition = conditions.find(c => c.type === 'Ready');
    if (readyCondition) {
      ready = readyCondition.status === 'True';
      status = readyCondition.status;
    } else {
      // Fallback: check if there's any condition with status True
      const anyTrueCondition = conditions.find(c => c.status === 'True');
      if (anyTrueCondition) {
        ready = true;
        status = 'True';
      } else if (conditions.length > 0) {
        status = conditions[0].status;
      }
    }
    
    // Additional check: if model has a URL, it's likely ready
    if (model.status?.url && !ready) {
      ready = true;
      status = 'True';
    }
    
    const modelInfo = {
      name: model.metadata.name,
      namespace: model.metadata.namespace,
      status: status,
      ready: ready,
      url: model.status?.url,
      predictor: model.spec.predictor,
      createdAt: model.metadata.creationTimestamp,
      conditions: conditions
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
    const { name, framework, storageUri, minReplicas, maxReplicas, scaleTarget, scaleMetric, namespace } = req.body;
    
    // For admin users, allow specifying namespace, otherwise use their tenant
    const tenant = req.user.isAdmin ? (namespace || req.user.tenant) : req.user.tenant;

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

// Admin-only endpoints
// Get system information
app.get('/api/admin/system', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nodeCommand = 'kubectl get nodes -o json';
    const namespaceCommand = 'kubectl get namespaces -o json';
    const deploymentCommand = 'kubectl get deployments -A -o json';
    
    const [nodes, namespaces, deployments] = await Promise.all([
      execCommand(nodeCommand),
      execCommand(namespaceCommand),
      execCommand(deploymentCommand)
    ]);
    
    const systemInfo = {
      nodes: JSON.parse(nodes).items.map(node => ({
        name: node.metadata.name,
        status: node.status.conditions.find(c => c.type === 'Ready')?.status || 'Unknown',
        version: node.status.nodeInfo.kubeletVersion,
        capacity: node.status.capacity,
        allocatable: node.status.allocatable
      })),
      namespaces: JSON.parse(namespaces).items.map(ns => ({
        name: ns.metadata.name,
        status: ns.status.phase,
        created: ns.metadata.creationTimestamp
      })),
      deployments: JSON.parse(deployments).items.map(dep => ({
        name: dep.metadata.name,
        namespace: dep.metadata.namespace,
        ready: dep.status.readyReplicas || 0,
        replicas: dep.status.replicas || 0,
        available: dep.status.availableReplicas || 0
      }))
    };
    
    res.json(systemInfo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system info', details: error.message });
  }
});

// Get all tenants/namespaces
app.get('/api/admin/tenants', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const command = 'kubectl get namespaces -o json';
    const result = await execCommand(command);
    const namespaces = JSON.parse(result);
    
    const tenants = namespaces.items
      .filter(ns => ['tenant-a', 'tenant-b', 'tenant-c'].includes(ns.metadata.name))
      .map(ns => ({
        name: ns.metadata.name,
        status: ns.status.phase,
        created: ns.metadata.creationTimestamp
      }));
    
    res.json({ tenants });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tenants', details: error.message });
  }
});

// Get cluster resources
app.get('/api/admin/resources', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const podsCommand = 'kubectl get pods -A -o json';
    const servicesCommand = 'kubectl get services -A -o json';
    const ingressCommand = 'kubectl get ingress -A -o json';
    
    const [pods, services, ingresses] = await Promise.all([
      execCommand(podsCommand),
      execCommand(servicesCommand),
      execCommand(ingressCommand).catch(() => '{"items": []}') // Ingress might not exist
    ]);
    
    const resources = {
      pods: JSON.parse(pods).items.map(pod => ({
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        status: pod.status.phase,
        ready: pod.status.containerStatuses?.every(c => c.ready) || false,
        restarts: pod.status.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) || 0,
        created: pod.metadata.creationTimestamp
      })),
      services: JSON.parse(services).items.map(svc => ({
        name: svc.metadata.name,
        namespace: svc.metadata.namespace,
        type: svc.spec.type,
        clusterIP: svc.spec.clusterIP,
        ports: svc.spec.ports
      })),
      ingresses: JSON.parse(ingresses).items.map(ing => ({
        name: ing.metadata.name,
        namespace: ing.metadata.namespace,
        hosts: ing.spec.rules?.map(r => r.host) || [],
        created: ing.metadata.creationTimestamp
      }))
    };
    
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get resources', details: error.message });
  }
});

// Get comprehensive logs
app.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { namespace, component, lines = 100 } = req.query;
    
    let command;
    if (namespace && component) {
      command = `kubectl logs -n ${namespace} -l app=${component} --tail=${lines}`;
    } else if (namespace) {
      command = `kubectl logs -n ${namespace} --all-containers=true --tail=${lines}`;
    } else {
      command = `kubectl logs -A --all-containers=true --tail=${lines}`;
    }
    
    const logs = await execCommand(command);
    res.json({ logs: logs.split('\n').filter(line => line.trim()) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs', details: error.message });
  }
});

// Execute kubectl command (admin only)
app.post('/api/admin/kubectl', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { command } = req.body;
    
    // Basic security check - only allow safe read operations
    const safeCommands = ['get', 'describe', 'logs', 'top'];
    const commandParts = command.split(' ');
    
    if (!safeCommands.includes(commandParts[0])) {
      return res.status(403).json({ error: 'Only safe read operations are allowed' });
    }
    
    const fullCommand = `kubectl ${command}`;
    const result = await execCommand(fullCommand);
    
    res.json({ result, command: fullCommand });
  } catch (error) {
    res.status(500).json({ error: 'Command execution failed', details: error.message });
  }
});

// Serve React app for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Management server running on port ${PORT}`);
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
  console.log('  GET  /* - Serve React application');
});