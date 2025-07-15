import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Globe, Key, Settings, Zap, AlertCircle, CheckCircle, X } from 'lucide-react';

const PublishingForm = ({ modelName, onComplete, onCancel }) => {
  const [formData, setFormData] = useState({
    tenantId: '',
    modelType: '', // Will be auto-detected
    externalPath: '',
    rateLimiting: {
      requestsPerMinute: 60,
      requestsPerHour: 3600,
      tokensPerHour: 100000,
      burstLimit: 10
    },
    authentication: {
      type: 'apikey',
      keyExpiration: ''
    },
    metadata: {}
  });
  const [loading, setLoading] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [modelDetails, setModelDetails] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenants, setTenants] = useState([]);
  const api = useApi();
  const { user } = useAuth();

  useEffect(() => {
    if (modelName) {
      fetchModelDetails();
      fetchTenantInfo();
      checkIfPublished();
      
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
    } catch (error) {
      console.error('Error fetching model details:', error);
      toast.error('Failed to fetch model details');
    }
  };

  const fetchTenantInfo = async () => {
    try {
      const response = await api.getTenantInfo();
      setTenantInfo(response.data);
      // Only set the default tenant if admin hasn't selected one
      if (!user?.isAdmin) {
        setFormData(prev => ({ ...prev, tenantId: response.data.tenant }));
      }
    } catch (error) {
      console.error('Error fetching tenant info:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.getTenants();
      setTenants(response.data.tenants || []);
      
      // Set default tenant for admin (first tenant or current user tenant)
      if (response.data.tenants && response.data.tenants.length > 0) {
        const defaultTenant = tenantInfo?.tenant || response.data.tenants[0].id;
        setFormData(prev => ({ ...prev, tenantId: defaultTenant }));
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to fetch tenant list');
    }
  };

  const checkIfPublished = async () => {
    try {
      const response = await api.getPublishedModel(modelName);
      setIsPublished(true);
      // Pre-populate form with existing data
      const publishedModel = response.data;
      setFormData(prev => ({
        ...prev,
        tenantId: publishedModel.tenantID,
        modelType: publishedModel.modelType,
        externalPath: publishedModel.externalURL?.split('/').pop() || '',
        rateLimiting: publishedModel.rateLimiting || prev.rateLimiting
      }));
    } catch (error) {
      // Model is not published, which is fine
      setIsPublished(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Add tenant parameter for admin users
      const requestBody = {
        config: formData
      };
      
      // If admin is publishing to a different tenant, include tenant in request
      if (user?.isAdmin && formData.tenantId !== tenantInfo?.tenant) {
        requestBody.config.tenantID = formData.tenantId;
      }
      
      const response = await api.publishModel(modelName, requestBody);
      
      toast.success('Model published successfully!');
      onComplete(response.data);
    } catch (error) {
      console.error('Error publishing model:', error);
      toast.error(error.response?.data?.error || 'Failed to publish model');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!window.confirm(`Are you sure you want to unpublish "${modelName}"?`)) {
      return;
    }

    try {
      setLoading(true);
      
      // Include namespace parameter for admin users
      const namespace = user?.isAdmin ? formData.tenantId : null;
      await api.unpublishModel(modelName, namespace);
      
      toast.success('Model unpublished successfully!');
      onComplete(null);
    } catch (error) {
      console.error('Error unpublishing model:', error);
      toast.error(error.response?.data?.error || 'Failed to unpublish model');
    } finally {
      setLoading(false);
    }
  };

  const getModelTypeDescription = (type) => {
    switch (type) {
      case 'openai':
        return 'OpenAI-compatible API with chat completions and embeddings endpoints';
      case 'traditional':
        return 'Traditional inference API with custom predict endpoints';
      default:
        return 'Auto-detected based on model configuration';
    }
  };

  const getDefaultExternalPath = () => {
    if (formData.modelType === 'openai') {
      return `/v1/models/${modelName}`;
    }
    return `/published/models/${modelName}`;
  };

  return (
    <div className="card">
      <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
        <h2 className="modal-title">
          {isPublished ? 'Update Published Model' : 'Publish Model'}: {modelName}
        </h2>
        {isPublished && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669' }}>
            <CheckCircle size={16} />
            <span>Currently Published</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Model Information */}
        <div className="form-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Globe size={18} />
            Model Information
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Model Name</label>
              <input
                type="text"
                value={modelName}
                className="form-control"
                disabled
                style={{ backgroundColor: '#f8fafc', color: '#6b7280' }}
              />
            </div>

            <div className="form-group">
              <label>Tenant</label>
              {user?.isAdmin ? (
                <select
                  name="tenantId"
                  value={formData.tenantId}
                  onChange={handleInputChange}
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
              ) : (
                <input
                  type="text"
                  value={formData.tenantId}
                  className="form-control"
                  disabled
                  style={{ backgroundColor: '#f8fafc', color: '#6b7280' }}
                />
              )}
              {user?.isAdmin && (
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Select the tenant namespace where the model should be published
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Model Type</label>
            <select
              name="modelType"
              value={formData.modelType}
              onChange={handleInputChange}
              className="form-control"
            >
              <option value="">Auto-detect</option>
              <option value="traditional">Traditional Inference</option>
              <option value="openai">OpenAI Compatible</option>
            </select>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              {getModelTypeDescription(formData.modelType)}
            </div>
          </div>

          <div className="form-group">
            <label>External Path</label>
            <input
              type="text"
              name="externalPath"
              value={formData.externalPath}
              onChange={handleInputChange}
              className="form-control"
              placeholder={getDefaultExternalPath()}
            />
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              The URL path where the model will be accessible externally
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="form-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Settings size={18} />
            Rate Limiting
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Requests per Minute</label>
              <input
                type="number"
                name="rateLimiting.requestsPerMinute"
                value={formData.rateLimiting.requestsPerMinute}
                onChange={handleInputChange}
                className="form-control"
                min="1"
                max="10000"
              />
            </div>

            <div className="form-group">
              <label>Requests per Hour</label>
              <input
                type="number"
                name="rateLimiting.requestsPerHour"
                value={formData.rateLimiting.requestsPerHour}
                onChange={handleInputChange}
                className="form-control"
                min="1"
                max="100000"
              />
            </div>

            <div className="form-group">
              <label>Tokens per Hour</label>
              <input
                type="number"
                name="rateLimiting.tokensPerHour"
                value={formData.rateLimiting.tokensPerHour}
                onChange={handleInputChange}
                className="form-control"
                min="1000"
                max="10000000"
              />
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Only applies to OpenAI-compatible models
              </div>
            </div>

            <div className="form-group">
              <label>Burst Limit</label>
              <input
                type="number"
                name="rateLimiting.burstLimit"
                value={formData.rateLimiting.burstLimit}
                onChange={handleInputChange}
                className="form-control"
                min="1"
                max="100"
              />
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="form-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Key size={18} />
            Authentication
          </h3>
          
          <div className="form-group">
            <label>Authentication Type</label>
            <select
              name="authentication.type"
              value={formData.authentication.type}
              onChange={handleInputChange}
              className="form-control"
            >
              <option value="apikey">API Key</option>
            </select>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              A secure API key will be generated for external access
            </div>
          </div>

          <div className="form-group">
            <label>Key Expiration (Optional)</label>
            <input
              type="datetime-local"
              name="authentication.keyExpiration"
              value={formData.authentication.keyExpiration}
              onChange={handleInputChange}
              className="form-control"
            />
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Leave empty for no expiration
            </div>
          </div>
        </div>

        {/* Model Status Warning */}
        {modelDetails && !modelDetails.ready && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fef3cd', 
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} style={{ color: '#f59e0b' }} />
            <div>
              <div style={{ fontWeight: '500', color: '#92400e' }}>Model Not Ready</div>
              <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
                This model is not currently ready. Publishing may fail if the model is not accessible.
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          
          {isPublished && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleUnpublish}
              disabled={loading}
            >
              {loading ? 'Unpublishing...' : 'Unpublish'}
            </button>
          )}
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Publishing...' : isPublished ? 'Update' : 'Publish'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PublishingForm;