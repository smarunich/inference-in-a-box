import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Globe, 
  Key, 
  Settings, 
  Activity,
  BookOpen,
  Copy,
  ExternalLink,
  RefreshCw,
  Zap
} from 'lucide-react';

const PublishingWorkflow = ({ modelName, onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [modelDetails, setModelDetails] = useState(null);
  const [publishConfig, setPublishConfig] = useState({
    tenantId: '',
    modelType: '',
    externalPath: '',
    rateLimiting: {
      requestsPerMinute: 60,
      requestsPerHour: 3600,
      tokensPerHour: 100000,
      burstLimit: 10
    },
    authentication: {
      requireApiKey: true,
      allowedTenants: []
    },
    metadata: {}
  });
  const [publishedModel, setPublishedModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [tenants, setTenants] = useState([]);
  const api = useApi();
  const { user } = useAuth();

  const steps = [
    { id: 1, title: 'Model Validation', icon: CheckCircle },
    { id: 2, title: 'Configuration', icon: Settings },
    { id: 3, title: 'Review & Publish', icon: Globe },
    { id: 4, title: 'Success & Documentation', icon: BookOpen }
  ];

  useEffect(() => {
    if (modelName) {
      fetchModelDetails();
      fetchTenantInfo();
      
      // If user is admin, fetch available tenants
      if (user?.isAdmin) {
        fetchTenants();
      }
    }
  }, [modelName, user]);

  const fetchModelDetails = async () => {
    try {
      const response = await api.getModel(modelName);
      setModelDetails(response.data);
      validateModel(response.data);
    } catch (error) {
      console.error('Error fetching model details:', error);
      toast.error('Failed to fetch model details');
    }
  };

  const fetchTenantInfo = async () => {
    try {
      const response = await api.getTenantInfo();
      // Only set default tenant if admin hasn't selected one
      if (!user?.isAdmin) {
        setPublishConfig(prev => ({ ...prev, tenantId: response.data.tenant }));
      }
    } catch (error) {
      console.error('Error fetching tenant info:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.getTenants();
      setTenants(response.data.tenants || []);
      
      // Set default tenant for admin
      if (response.data.tenants && response.data.tenants.length > 0) {
        const defaultTenant = response.data.tenants[0].id;
        setPublishConfig(prev => ({ ...prev, tenantId: defaultTenant }));
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to fetch tenant list');
    }
  };

  const validateModel = (model) => {
    const errors = [];
    
    if (!model.ready) {
      errors.push({
        type: 'warning',
        message: 'Model is not ready. Publishing may fail if the model is not accessible.',
        field: 'status'
      });
    }

    if (!model.url) {
      errors.push({
        type: 'error',
        message: 'Model does not have an accessible URL.',
        field: 'url'
      });
    }

    if (model.statusDetails?.error) {
      errors.push({
        type: 'error',
        message: `Model has errors: ${model.statusDetails.error}`,
        field: 'status'
      });
    }

    setValidationErrors(errors);
  };

  const handleConfigChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setPublishConfig(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setPublishConfig(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      // Add tenant parameter for admin users
      const requestBody = {
        config: publishConfig
      };
      
      // If admin is publishing to a specific tenant, include tenant in request
      if (user?.isAdmin && publishConfig.tenantId) {
        requestBody.config.tenantId = publishConfig.tenantId;
      }
      
      const response = await api.publishModel(modelName, requestBody);
      
      setPublishedModel(response.data.publishedModel);
      setCurrentStep(4);
      toast.success('Model published successfully!');
    } catch (error) {
      console.error('Error publishing model:', error);
      toast.error(error.response?.data?.error || 'Failed to publish model');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const renderStepIndicator = () => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      marginBottom: '2rem',
      padding: '1rem',
      backgroundColor: '#f8fafc',
      borderRadius: '8px'
    }}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            opacity: currentStep >= step.id ? 1 : 0.5
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: currentStep >= step.id ? '#3b82f6' : '#e5e7eb',
              color: currentStep >= step.id ? 'white' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.5rem'
            }}>
              <step.icon size={20} />
            </div>
            <div style={{ 
              fontSize: '0.875rem', 
              fontWeight: '500',
              textAlign: 'center',
              color: currentStep >= step.id ? '#1f2937' : '#6b7280'
            }}>
              {step.title}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div style={{
              width: '60px',
              height: '2px',
              backgroundColor: currentStep > step.id ? '#3b82f6' : '#e5e7eb',
              margin: '0 1rem',
              marginTop: '-20px'
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="card">
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <CheckCircle size={20} />
        Model Validation
      </h3>

      {modelDetails && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            padding: '1rem',
            backgroundColor: '#f8fafc',
            borderRadius: '6px'
          }}>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Model Name</div>
              <div>{modelDetails.name}</div>
            </div>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Namespace</div>
              <div>{modelDetails.namespace}</div>
            </div>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {modelDetails.ready ? (
                  <>
                    <CheckCircle size={16} style={{ color: '#10b981' }} />
                    <span style={{ color: '#10b981' }}>Ready</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} style={{ color: '#f59e0b' }} />
                    <span style={{ color: '#f59e0b' }}>Not Ready</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>URL</div>
              <div>{modelDetails.url || 'Not available'}</div>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h4>Validation Results</h4>
              {validationErrors.map((error, index) => (
                <div 
                  key={index}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    backgroundColor: error.type === 'error' ? '#fef2f2' : '#fef3cd',
                    border: `1px solid ${error.type === 'error' ? '#fecaca' : '#fde68a'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertCircle 
                    size={16} 
                    style={{ color: error.type === 'error' ? '#dc2626' : '#f59e0b' }} 
                  />
                  <span style={{ color: error.type === 'error' ? '#dc2626' : '#92400e' }}>
                    {error.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => setCurrentStep(2)}
              disabled={validationErrors.some(e => e.type === 'error')}
            >
              Continue to Configuration
              <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="card">
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Settings size={20} />
        Publishing Configuration
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Tenant Selection - Only for admins */}
        {user?.isAdmin && (
          <div>
            <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={16} />
              Target Tenant
            </h4>
            <div className="form-group">
              <select
                value={publishConfig.tenantId}
                onChange={(e) => handleConfigChange('tenantId', e.target.value)}
                className="form-control"
                required
              >
                <option value="">Select a tenant</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name || tenant.id}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                Select the tenant namespace where the model should be published
              </div>
            </div>
          </div>
        )}
        
        {/* Model Type Detection */}
        <div>
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={16} />
            Model Type
          </h4>
          <div className="form-group">
            <select
              value={publishConfig.modelType}
              onChange={(e) => handleConfigChange('modelType', e.target.value)}
              className="form-control"
            >
              <option value="">Auto-detect</option>
              <option value="traditional">Traditional Inference</option>
              <option value="openai">OpenAI Compatible</option>
            </select>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              {publishConfig.modelType === 'openai' && 
                'OpenAI-compatible API with chat completions and embeddings endpoints'}
              {publishConfig.modelType === 'traditional' && 
                'Traditional inference API with custom predict endpoints'}
              {!publishConfig.modelType && 
                'Model type will be automatically detected based on configuration'}
            </div>
          </div>
        </div>

        {/* External Access */}
        <div>
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={16} />
            External Access
          </h4>
          <div className="form-group">
            <label>External Path</label>
            <input
              type="text"
              value={publishConfig.externalPath}
              onChange={(e) => handleConfigChange('externalPath', e.target.value)}
              className="form-control"
              placeholder={publishConfig.modelType === 'openai' ? 
                `/v1/models/${modelName}` : 
                `/published/models/${modelName}`
              }
            />
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              The URL path where the model will be accessible externally
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div>
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} />
            Rate Limiting
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Requests per Minute</label>
              <input
                type="number"
                value={publishConfig.rateLimiting.requestsPerMinute}
                onChange={(e) => handleConfigChange('rateLimiting.requestsPerMinute', parseInt(e.target.value))}
                className="form-control"
                min="1"
                max="10000"
              />
            </div>
            <div className="form-group">
              <label>Requests per Hour</label>
              <input
                type="number"
                value={publishConfig.rateLimiting.requestsPerHour}
                onChange={(e) => handleConfigChange('rateLimiting.requestsPerHour', parseInt(e.target.value))}
                className="form-control"
                min="1"
                max="100000"
              />
            </div>
            <div className="form-group">
              <label>Tokens per Hour</label>
              <input
                type="number"
                value={publishConfig.rateLimiting.tokensPerHour}
                onChange={(e) => handleConfigChange('rateLimiting.tokensPerHour', parseInt(e.target.value))}
                className="form-control"
                min="1000"
                max="10000000"
              />
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                For OpenAI models only
              </div>
            </div>
            <div className="form-group">
              <label>Burst Limit</label>
              <input
                type="number"
                value={publishConfig.rateLimiting.burstLimit}
                onChange={(e) => handleConfigChange('rateLimiting.burstLimit', parseInt(e.target.value))}
                className="form-control"
                min="1"
                max="100"
              />
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div>
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={16} />
            Authentication
          </h4>
          <div className="form-group">
            <label>Require API Key</label>
            <select
              value={publishConfig.authentication.requireApiKey}
              onChange={(e) => handleConfigChange('authentication.requireApiKey', e.target.value === 'true')}
              className="form-control"
            >
              <option value={true}>Yes</option>
              <option value={false}>No</option>
            </select>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              A secure API key will be generated for external access
            </div>
          </div>
          
          <div className="form-group">
            <label>Allowed Tenants (Optional)</label>
            <input
              type="text"
              value={publishConfig.authentication.allowedTenants.join(', ')}
              onChange={(e) => handleConfigChange('authentication.allowedTenants', 
                e.target.value.split(',').map(t => t.trim()).filter(t => t)
              )}
              className="form-control"
              placeholder="tenant-a, tenant-b"
            />
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Comma-separated list of tenants allowed to access this model (leave empty for all)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setCurrentStep(1)}
          >
            Back to Validation
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setCurrentStep(3)}
          >
            Review Configuration
            <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="card">
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Globe size={20} />
        Review & Publish
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Configuration Summary */}
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f8fafc', 
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ marginBottom: '1rem' }}>Configuration Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Model</div>
              <div>{modelName}</div>
            </div>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Type</div>
              <div>{publishConfig.modelType || 'Auto-detect'}</div>
            </div>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>External Path</div>
              <div>{publishConfig.externalPath || 'Default'}</div>
            </div>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Rate Limit</div>
              <div>{publishConfig.rateLimiting.requestsPerMinute}/min</div>
            </div>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Authentication</div>
              <div>{publishConfig.authentication.requireApiKey ? 'API Key Required' : 'No Authentication'}</div>
            </div>
            {publishConfig.authentication.allowedTenants.length > 0 && (
              <div>
                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Allowed Tenants</div>
                <div>{publishConfig.authentication.allowedTenants.join(', ')}</div>
              </div>
            )}
          </div>
        </div>

        {/* Expected Endpoints */}
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f0f9ff', 
          borderRadius: '6px',
          border: '1px solid #bfdbfe'
        }}>
          <h4 style={{ marginBottom: '1rem', color: '#1e40af' }}>Expected External Endpoints</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              https://gateway.example.com{publishConfig.externalPath || 
                (publishConfig.modelType === 'openai' ? `/v1/models/${modelName}` : `/published/models/${modelName}`)}
            </div>
            {publishConfig.modelType === 'openai' && (
              <>
                <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  https://gateway.example.com/v1/chat/completions
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  https://gateway.example.com/v1/embeddings
                </div>
              </>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fef3cd', 
          borderRadius: '6px',
          border: '1px solid #fde68a',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Key size={16} style={{ color: '#f59e0b' }} />
          <div>
            <div style={{ fontWeight: '500', color: '#92400e' }}>Security Notice</div>
            <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
              A unique API key will be generated for this model. Keep it secure and rotate it regularly.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setCurrentStep(2)}
          >
            Back to Configuration
          </button>
          <button 
            className="btn btn-primary"
            onClick={handlePublish}
            disabled={loading}
          >
            {loading ? 'Publishing...' : 'Publish Model'}
            {!loading && <Globe size={16} style={{ marginLeft: '0.5rem' }} />}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="card">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '1rem' }} />
        <h2 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Model Published Successfully!</h2>
        <p style={{ color: '#6b7280' }}>
          Your model is now available for external access with secure API key authentication.
        </p>
      </div>

      {publishedModel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Access Information */}
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f0fdf4', 
            borderRadius: '6px',
            border: '1px solid #bbf7d0'
          }}>
            <h4 style={{ marginBottom: '1rem', color: '#166534' }}>Access Information</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>External URL</div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px solid #d1fae5'
                }}>
                  <code style={{ flex: 1, fontSize: '0.875rem' }}>{publishedModel.externalURL}</code>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(publishedModel.externalURL)}
                  >
                    <Copy size={14} />
                  </button>
                  <a 
                    href={publishedModel.externalURL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>API Key</div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px solid #d1fae5'
                }}>
                  <code style={{ flex: 1, fontSize: '0.875rem', fontFamily: 'monospace' }}>
                    {publishedModel.apiKey}
                  </code>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(publishedModel.apiKey)}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* API Documentation */}
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f8fafc', 
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}>
            <h4 style={{ marginBottom: '1rem' }}>API Documentation</h4>
            <div>
              <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>Example Request</div>
              <pre style={{ 
                backgroundColor: '#1f2937', 
                color: '#f9fafb',
                padding: '1rem', 
                borderRadius: '4px', 
                fontSize: '0.875rem',
                overflow: 'auto'
              }}>
{publishedModel.documentation?.sdkExamples?.curl || 
`curl -X POST "${publishedModel.externalURL}/predict" \\
  -H "X-API-Key: ${publishedModel.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"instances": [{"data": "example"}]}'`}
              </pre>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => onComplete(publishedModel)}
            >
              View Published Models
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setCurrentStep(1);
                setPublishedModel(null);
              }}
            >
              Publish Another Model
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Model Publishing Workflow</h1>
        <p style={{ color: '#6b7280' }}>
          Publish your model for external access with secure API key authentication and rate limiting.
        </p>
      </div>

      {renderStepIndicator()}

      <div>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>
    </div>
  );
};

export default PublishingWorkflow;