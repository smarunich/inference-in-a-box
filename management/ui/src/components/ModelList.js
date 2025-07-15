import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import { RefreshCw, Edit, Trash2, Play, FileText, Info, ExternalLink, AlertCircle, CheckCircle, Clock, Globe } from 'lucide-react';
import ModelForm from './ModelForm';
import JsonView from '@uiw/react-json-view';

const ModelList = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState(null);
  const [showLogs, setShowLogs] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showStatus, setShowStatus] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // all, ready, not-ready, error
  const [publishedModels, setPublishedModels] = useState([]);
  const api = useApi();

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const [modelsResponse, publishedResponse] = await Promise.all([
        api.getModels(),
        api.getPublishedModels().catch(() => ({ data: { publishedModels: [] } }))
      ]);
      
      const models = modelsResponse.data.models || [];
      const published = publishedResponse.data.publishedModels || [];
      
      console.log('ModelList - fetched models:', models);
      console.log('ModelList - fetched published models:', published);
      
      // Debug each model's status
      models.forEach(model => {
        console.log(`Model ${model.name}:`, {
          ready: model.ready,
          status: model.status,
          conditions: model.conditions,
          url: model.url
        });
      });
      
      setModels(models);
      setPublishedModels(published);
    } catch (error) {
      toast.error('Failed to fetch models');
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (modelName) => {
    if (!window.confirm(`Are you sure you want to delete model "${modelName}"?`)) {
      return;
    }

    try {
      await api.deleteModel(modelName);
      toast.success(`Model "${modelName}" deleted successfully`);
      fetchModels();
    } catch (error) {
      toast.error(`Failed to delete model "${modelName}"`);
      console.error('Error deleting model:', error);
    }
  };

  const handleEdit = (model) => {
    setEditingModel(model);
  };

  const handleEditComplete = () => {
    setEditingModel(null);
    fetchModels();
  };

  const handleViewLogs = async (modelName) => {
    try {
      const response = await api.getModelLogs(modelName, 100);
      setLogs(response.data.logs || []);
      setShowLogs(modelName);
    } catch (error) {
      toast.error(`Failed to fetch logs for model "${modelName}"`);
      console.error('Error fetching logs:', error);
    }
  };

  const getStatusBadge = (model) => {
    const isReady = model.ready;
    const hasError = model.statusDetails?.error;
    
    if (hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="status-badge status-not-ready">
            <AlertCircle size={12} />
            Error
          </span>
        </div>
      );
    }
    
    if (isReady) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="status-badge status-ready">
            <CheckCircle size={12} />
            Ready
          </span>
          {model.statusDetails?.url && (
            <a 
              href={model.statusDetails.url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#3b82f6', textDecoration: 'none' }}
              title="Open model endpoint"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      );
    }
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="status-badge status-not-ready">
          <Clock size={12} />
          {model.statusDetails?.phase || 'Not Ready'}
        </span>
      </div>
    );
  };

  const getComponentStatus = (model) => {
    const components = model.statusDetails?.components || {};
    const componentList = [];
    
    if (components.predictor) {
      componentList.push({
        name: 'Predictor',
        ready: components.predictor.ready,
        url: components.predictor.url
      });
    }
    
    if (components.transformer) {
      componentList.push({
        name: 'Transformer', 
        ready: components.transformer.ready,
        url: components.transformer.url
      });
    }
    
    if (components.explainer) {
      componentList.push({
        name: 'Explainer',
        ready: components.explainer.ready, 
        url: components.explainer.url
      });
    }
    
    return componentList;
  };

  const handleViewStatus = (model) => {
    setShowStatus(model);
  };

  const isModelPublished = (modelName) => {
    return publishedModels.some(pm => pm.modelName === modelName);
  };

  const handlePublish = (modelName) => {
    // Navigate to publishing workflow
    window.location.hash = '#publishing';
    toast.success(`Opening publishing workflow for "${modelName}"`);
  };

  const filteredModels = models.filter(model => {
    switch (statusFilter) {
      case 'ready':
        return model.ready;
      case 'not-ready':
        return !model.ready;
      case 'error':
        return model.statusDetails?.error;
      default:
        return true;
    }
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">Loading models...</div>
      </div>
    );
  }

  // Edit modal
  if (editingModel) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h2 className="modal-title">Edit Model: {editingModel.name}</h2>
            <button className="modal-close" onClick={() => setEditingModel(null)}>×</button>
          </div>
          <ModelForm 
            model={editingModel} 
            onComplete={handleEditComplete}
            onCancel={() => setEditingModel(null)}
          />
        </div>
      </div>
    );
  }

  // Logs modal
  if (showLogs) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: '800px' }}>
          <div className="modal-header">
            <h2 className="modal-title">Logs: {showLogs}</h2>
            <button className="modal-close" onClick={() => setShowLogs(null)}>×</button>
          </div>
          <div className="code-block" style={{ maxHeight: '400px', overflow: 'auto' }}>
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            ) : (
              <div>No logs available</div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowLogs(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Status details modal
  if (showStatus) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: '900px', maxHeight: '90vh' }}>
          <div className="modal-header">
            <h2 className="modal-title">Status Details: {showStatus.name}</h2>
            <button className="modal-close" onClick={() => setShowStatus(null)}>×</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
            
            {/* Overall Status */}
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} color="#10b981" />
                Overall Status
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '500' }}>Ready</div>
                  <div style={{ color: showStatus.ready ? '#10b981' : '#ef4444' }}>
                    {showStatus.ready ? 'Yes' : 'No'}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: '500' }}>Phase</div>
                  <div>{showStatus.statusDetails?.phase || 'Unknown'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '500' }}>URL</div>
                  <div>
                    {showStatus.url ? (
                      <a href={showStatus.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                        {showStatus.url}
                      </a>
                    ) : 'None'}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: '500' }}>Observed Generation</div>
                  <div>{showStatus.statusDetails?.observedGeneration || 'N/A'}</div>
                </div>
              </div>
              {showStatus.statusDetails?.error && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <div style={{ fontWeight: '500', color: '#dc2626' }}>Error</div>
                  <div style={{ color: '#dc2626', fontSize: '0.875rem' }}>{showStatus.statusDetails.error}</div>
                </div>
              )}
            </div>

            {/* Components Status */}
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Component Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(showStatus.statusDetails?.components || {}).map(([name, component]) => {
                  if (!component) return null;
                  return (
                    <div key={name} style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: component.ready ? '#10b981' : '#ef4444' 
                          }}></span>
                          <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{name}</span>
                        </div>
                        <span style={{ color: component.ready ? '#10b981' : '#ef4444' }}>
                          {component.ready ? 'Ready' : 'Not Ready'}
                        </span>
                      </div>
                      {component.url && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                          <a href={component.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                            {component.url}
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Replicas Status */}
            {showStatus.statusDetails?.replicas && (
              <div className="card" style={{ padding: '1rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Replica Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#15803d' }}>
                      {showStatus.statusDetails.replicas.ready}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#166534' }}>Ready</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0369a1' }}>
                      {showStatus.statusDetails.replicas.total}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#075985' }}>Total</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fefce8', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ca8a04' }}>
                      {showStatus.statusDetails.replicas.desired}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#a16207' }}>Desired</div>
                  </div>
                </div>
              </div>
            )}

            {/* Conditions */}
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Conditions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {showStatus.statusDetails?.conditions?.map((condition, index) => (
                  <div key={index} style={{ 
                    padding: '0.75rem', 
                    backgroundColor: condition.status === 'True' ? '#f0fdf4' : condition.status === 'False' ? '#fef2f2' : '#f8fafc',
                    borderRadius: '6px',
                    border: `1px solid ${condition.status === 'True' ? '#bbf7d0' : condition.status === 'False' ? '#fecaca' : '#e5e7eb'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '500' }}>{condition.type}</span>
                      <span style={{ 
                        padding: '0.125rem 0.5rem', 
                        borderRadius: '9999px', 
                        fontSize: '0.75rem',
                        backgroundColor: condition.status === 'True' ? '#dcfce7' : condition.status === 'False' ? '#fee2e2' : '#f3f4f6',
                        color: condition.status === 'True' ? '#166534' : condition.status === 'False' ? '#dc2626' : '#374151'
                      }}>
                        {condition.status}
                      </span>
                    </div>
                    {condition.reason && (
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        <strong>Reason:</strong> {condition.reason}
                      </div>
                    )}
                    {condition.message && (
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        <strong>Message:</strong> {condition.message}
                      </div>
                    )}
                    {condition.lastTransitionTime && (
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        Last Transition: {new Date(condition.lastTransitionTime).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Raw Status Data */}
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Raw Status Data</h3>
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                <JsonView
                  value={showStatus.statusDetails}
                  collapsed={1}
                  style={{ fontSize: '0.875rem' }}
                />
              </div>
            </div>
          </div>
          
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowStatus(null)}>
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
        <h2>Models ({filteredModels.length})</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select"
            style={{ width: 'auto', fontSize: '0.875rem' }}
          >
            <option value="all">All Status</option>
            <option value="ready">Ready Only</option>
            <option value="not-ready">Not Ready</option>
            <option value="error">With Errors</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={fetchModels}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {filteredModels.length === 0 ? (
        <div className="empty-state">
          <h3>No models found</h3>
          <p>Create your first model to get started</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Components</th>
                <th>Framework</th>
                <th>Replicas</th>
                <th>URL</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((model) => {
                const framework = Object.keys(model.predictor || {}).find(key => 
                  !['minReplicas', 'maxReplicas', 'scaleTarget', 'scaleMetric'].includes(key)
                );
                const components = getComponentStatus(model);
                const replicas = model.statusDetails?.replicas;
                
                return (
                  <tr key={model.name}>
                    <td>
                      <div>
                        <div style={{ fontWeight: '500' }}>{model.name}</div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {model.namespace}
                        </div>
                        {model.statusDetails?.error && (
                          <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
                            {model.statusDetails.error}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{getStatusBadge(model)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {components.map(component => (
                          <div key={component.name} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ 
                              width: '8px', 
                              height: '8px', 
                              borderRadius: '50%', 
                              backgroundColor: component.ready ? '#10b981' : '#ef4444' 
                            }}></span>
                            <span style={{ fontSize: '0.75rem' }}>{component.name}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>{framework || 'Unknown'}</td>
                    <td>
                      <div>
                        <div style={{ fontSize: '0.875rem' }}>
                          {replicas ? `${replicas.ready}/${replicas.total}` : `${model.predictor?.minReplicas || 0}-${model.predictor?.maxReplicas || 0}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {replicas ? 'ready/total' : 'min-max'}
                        </div>
                      </div>
                    </td>
                    <td>
                      {model.url ? (
                        <a 
                          href={model.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: '#3b82f6', 
                            textDecoration: 'none', 
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <ExternalLink size={12} />
                          Endpoint
                        </a>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>None</span>
                      )}
                    </td>
                    <td>{formatDate(model.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewStatus(model)}
                          title="View Status Details"
                        >
                          <Info size={14} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEdit(model)}
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewLogs(model.name)}
                          title="View Logs"
                        >
                          <FileText size={14} />
                        </button>
                        {model.ready && !isModelPublished(model.name) && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePublish(model.name)}
                            title="Publish for External Access"
                          >
                            <Globe size={14} />
                          </button>
                        )}
                        {isModelPublished(model.name) && (
                          <button
                            className="btn btn-success btn-sm"
                            disabled
                            title="Already Published"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(model.name)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ModelList;