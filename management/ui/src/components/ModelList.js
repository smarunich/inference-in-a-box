import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import { RefreshCw, Edit, Trash2, Play, FileText } from 'lucide-react';
import ModelForm from './ModelForm';

const ModelList = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState(null);
  const [showLogs, setShowLogs] = useState(null);
  const [logs, setLogs] = useState([]);
  const api = useApi();

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await api.getModels();
      const models = response.data.models || [];
      console.log('ModelList - fetched models:', models);
      
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
    const className = isReady ? 'status-ready' : 'status-not-ready';
    const text = isReady ? 'Ready' : 'Not Ready';
    return <span className={`status-badge ${className}`}>{text}</span>;
  };

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

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Models</h2>
        <button className="btn btn-secondary btn-sm" onClick={fetchModels}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {models.length === 0 ? (
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
                <th>Framework</th>
                <th>Replicas</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => {
                const framework = Object.keys(model.predictor || {}).find(key => 
                  !['minReplicas', 'maxReplicas', 'scaleTarget', 'scaleMetric'].includes(key)
                );
                
                return (
                  <tr key={model.name}>
                    <td>
                      <div>
                        <div style={{ fontWeight: '500' }}>{model.name}</div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {model.namespace}
                        </div>
                      </div>
                    </td>
                    <td>{getStatusBadge(model)}</td>
                    <td>{framework || 'Unknown'}</td>
                    <td>
                      {model.predictor?.minReplicas || 0} - {model.predictor?.maxReplicas || 0}
                    </td>
                    <td>{formatDate(model.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
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