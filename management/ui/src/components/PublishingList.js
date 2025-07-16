import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  RefreshCw, 
  Eye, 
  RotateCcw, 
  Trash2, 
  Key, 
  Globe, 
  Clock,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  BookOpen,
  Settings,
  Activity
} from 'lucide-react';

const PublishingList = () => {
  const [publishedModels, setPublishedModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(null);
  const api = useApi();
  const { user } = useAuth();

  useEffect(() => {
    fetchPublishedModels();
  }, []);

  const fetchPublishedModels = async () => {
    try {
      setLoading(true);
      const response = await api.getPublishedModels();
      const models = response.data.publishedModels || [];
      console.log('PublishingList - fetched published models:', models);
      setPublishedModels(models);
    } catch (error) {
      toast.error('Failed to fetch published models');
      console.error('Error fetching published models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (model) => {
    setSelectedModel(model);
    setShowDetails(true);
  };

  const handleRotateKey = async (modelName, modelTenant) => {
    if (!window.confirm(`Are you sure you want to rotate the API key for model "${modelName}"? This will invalidate the current key.`)) {
      return;
    }

    try {
      setRotatingKey(modelName);
      // Use the model's tenant or the user's tenant as namespace
      const namespace = modelTenant || user?.tenant;
      const response = await api.rotateAPIKey(modelName, namespace);
      toast.success('API key rotated successfully');
      
      // Update the model in the list with the new key
      setPublishedModels(prev => 
        prev.map(model => 
          model.modelName === modelName 
            ? { ...model, apiKey: response.data.newApiKey, updatedAt: response.data.updatedAt }
            : model
        )
      );
    } catch (error) {
      toast.error(`Failed to rotate API key for model "${modelName}"`);
      console.error('Error rotating API key:', error);
    } finally {
      setRotatingKey(null);
    }
  };

  const handleUnpublish = async (modelName, modelTenant) => {
    if (!window.confirm(`Are you sure you want to unpublish model "${modelName}"? This will remove external access.`)) {
      return;
    }

    try {
      await api.unpublishModel(modelName);
      toast.success(`Model "${modelName}" unpublished successfully`);
      fetchPublishedModels();
    } catch (error) {
      toast.error(`Failed to unpublish model "${modelName}"`);
      console.error('Error unpublishing model:', error);
    }
  };


  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span className="status-badge status-ready">
            <CheckCircle size={12} />
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="status-badge status-not-ready">
            <AlertCircle size={12} />
            Inactive
          </span>
        );
      default:
        return (
          <span className="status-badge">
            <Clock size={12} />
            {status}
          </span>
        );
    }
  };

  const getModelTypeBadge = (modelType) => {
    return (
      <span className={`model-type-badge ${modelType === 'openai' ? 'openai' : 'traditional'}`}>
        {modelType === 'openai' ? 'OpenAI' : 'Traditional'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">Loading published models...</div>
      </div>
    );
  }

  // Details modal
  if (showDetails && selectedModel) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: '900px', maxHeight: '90vh' }}>
          <div className="modal-header">
            <h2 className="modal-title">Published Model Details: {selectedModel.modelName}</h2>
            <button className="modal-close" onClick={() => setShowDetails(false)}>×</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
            
            {/* Basic Info */}
            <div className="card" style={{ padding: '1rem', margin: 0 }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={18} />
                Basic Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Model Name</div>
                  <div>{selectedModel.modelName}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Tenant</div>
                  <div>{selectedModel.tenantID}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Type</div>
                  <div>{getModelTypeBadge(selectedModel.modelType)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Status</div>
                  <div>{getStatusBadge(selectedModel.status)}</div>
                </div>
              </div>
            </div>

            {/* Access Information */}
            <div className="card" style={{ padding: '1rem', margin: 0 }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} />
                Access Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>External URL</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px', fontSize: '0.875rem' }}>
                    <code style={{ flex: 1 }}>{selectedModel.externalURL}</code>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(selectedModel.externalURL)}
                      title="Copy URL"
                    >
                      <Copy size={14} />
                    </button>
                    <a 
                      href={selectedModel.externalURL} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      title="Open in new tab"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>API Key</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px', fontSize: '0.875rem' }}>
                    <code style={{ flex: 1, fontFamily: 'monospace' }}>
                      {selectedModel.apiKey.substring(0, 20)}...
                    </code>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(selectedModel.apiKey)}
                      title="Copy API Key"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="card" style={{ padding: '1rem', margin: 0 }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={18} />
                Rate Limiting
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Requests/Min</div>
                  <div>{selectedModel.rateLimiting?.requestsPerMinute || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Requests/Hour</div>
                  <div>{selectedModel.rateLimiting?.requestsPerHour || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Tokens/Hour</div>
                  <div>{selectedModel.rateLimiting?.tokensPerHour || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Burst Limit</div>
                  <div>{selectedModel.rateLimiting?.burstLimit || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="card" style={{ padding: '1rem', margin: 0 }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} />
                Usage Statistics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Total Requests</div>
                  <div>{selectedModel.usage?.totalRequests || 0}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Total Tokens</div>
                  <div>{selectedModel.usage?.totalTokens || 0}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Last Used</div>
                  <div>{formatDate(selectedModel.usage?.lastUsed)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Errors</div>
                  <div>{selectedModel.usage?.errors || 0}</div>
                </div>
              </div>
            </div>

            {/* API Documentation */}
            {selectedModel.documentation && (
              <div className="card" style={{ padding: '1rem', margin: 0 }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={18} />
                  API Documentation
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>Example Request</div>
                    <pre style={{ 
                      backgroundColor: '#f8fafc', 
                      padding: '1rem', 
                      borderRadius: '4px', 
                      fontSize: '0.875rem',
                      overflow: 'auto'
                    }}>
                      {selectedModel.documentation.sdkExamples?.curl || 'No example available'}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="card" style={{ padding: '1rem', margin: 0 }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} />
                Timestamps
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Created</div>
                  <div>{formatDate(selectedModel.createdAt)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Updated</div>
                  <div>{formatDate(selectedModel.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Published Models ({publishedModels.length})</h2>
        <button className="btn btn-secondary btn-sm" onClick={fetchPublishedModels}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {publishedModels.length === 0 ? (
        <div className="empty-state">
          <h3>No published models</h3>
          <p>Publish your first model to make it available externally</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Status</th>
                <th>Type</th>
                <th>External URL</th>
                <th>Rate Limits</th>
                <th>Usage</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {publishedModels.map((model) => (
                <tr key={`${model.tenantID}-${model.modelName}`}>
                  <td>
                    <div>
                      <div style={{ fontWeight: '500' }}>{model.modelName}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {model.tenantID}
                      </div>
                    </div>
                  </td>
                  <td>{getStatusBadge(model.status)}</td>
                  <td>{getModelTypeBadge(model.modelType)}</td>
                  <td>
                    <div style={{ fontSize: '0.875rem' }}>
                      <a 
                        href={model.externalURL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: '#3b82f6', 
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Globe size={12} />
                        View
                      </a>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.875rem' }}>
                      <div>{model.rateLimiting?.requestsPerMinute || 0}/min</div>
                      <div style={{ color: '#6b7280' }}>
                        {model.rateLimiting?.requestsPerHour || 0}/hr
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.875rem' }}>
                      <div>{model.usage?.totalRequests || 0} requests</div>
                      <div style={{ color: '#6b7280' }}>
                        {model.usage?.totalTokens || 0} tokens
                      </div>
                    </div>
                  </td>
                  <td>{formatDate(model.updatedAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewDetails(model)}
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRotateKey(model.modelName, model.tenantID)}
                        disabled={rotatingKey === model.modelName}
                        title="Rotate API Key"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleUnpublish(model.modelName, model.tenantID)}
                        title="Unpublish"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PublishingList;