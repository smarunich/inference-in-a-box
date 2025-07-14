import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const ModelForm = ({ model, onComplete, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    framework: '',
    storageUri: '',
    minReplicas: 1,
    maxReplicas: 3,
    scaleTarget: 60,
    scaleMetric: 'concurrency',
    namespace: ''
  });
  const [frameworks, setFrameworks] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingFrameworks, setLoadingFrameworks] = useState(true);
  const api = useApi();
  const { user } = useAuth();

  const isEdit = !!model;

  useEffect(() => {
    fetchFrameworks();
    if (user?.isAdmin) {
      fetchTenants();
    }
    
    if (model) {
      // Pre-populate form for editing
      const framework = Object.keys(model.predictor || {}).find(key => 
        !['minReplicas', 'maxReplicas', 'scaleTarget', 'scaleMetric'].includes(key)
      );
      
      setFormData({
        name: model.name,
        framework: framework || '',
        storageUri: model.predictor?.[framework]?.storageUri || '',
        minReplicas: model.predictor?.minReplicas || 1,
        maxReplicas: model.predictor?.maxReplicas || 3,
        scaleTarget: model.predictor?.scaleTarget || 60,
        scaleMetric: model.predictor?.scaleMetric || 'concurrency',
        namespace: model.namespace || ''
      });
    }
  }, [model, user]);

  const fetchTenants = async () => {
    try {
      const response = await api.getTenants();
      setTenants(response.data.tenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchFrameworks = async () => {
    try {
      const response = await api.getFrameworks();
      setFrameworks(response.data.frameworks || []);
    } catch (error) {
      toast.error('Failed to fetch frameworks');
      console.error('Error fetching frameworks:', error);
    } finally {
      setLoadingFrameworks(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'minReplicas' || name === 'maxReplicas' || name === 'scaleTarget' 
        ? parseInt(value, 10) || 0 
        : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.framework || !formData.storageUri) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (user?.isAdmin && !formData.namespace) {
      toast.error('Please select a namespace');
      return;
    }

    if (formData.minReplicas > formData.maxReplicas) {
      toast.error('Min replicas cannot be greater than max replicas');
      return;
    }

    setLoading(true);

    try {
      if (isEdit) {
        await api.updateModel(model.name, {
          framework: formData.framework,
          storageUri: formData.storageUri,
          minReplicas: formData.minReplicas,
          maxReplicas: formData.maxReplicas,
          scaleTarget: formData.scaleTarget,
          scaleMetric: formData.scaleMetric
        });
        toast.success(`Model "${model.name}" updated successfully`);
      } else {
        await api.createModel(formData);
        toast.success(`Model "${formData.name}" created successfully`);
      }
      
      if (onComplete) {
        onComplete();
      }
      
      // Reset form if creating new model
      if (!isEdit) {
        setFormData({
          name: '',
          framework: '',
          storageUri: '',
          minReplicas: 1,
          maxReplicas: 3,
          scaleTarget: 60,
          scaleMetric: 'concurrency'
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to save model';
      toast.error(errorMessage);
      console.error('Error saving model:', error);
    } finally {
      setLoading(false);
    }
  };

  const storageUriExamples = {
    sklearn: 'gs://kfserving-examples/models/sklearn/1.0/model',
    tensorflow: 'gs://kfserving-examples/models/tensorflow/flowers',
    pytorch: 'gs://kfserving-examples/models/pytorch/1.0/model',
    onnx: 'gs://kfserving-examples/models/onnx/1.0/model',
    xgboost: 'gs://kfserving-examples/models/xgboost/1.0/model'
  };

  if (loadingFrameworks) {
    return (
      <div className="card">
        <div className="loading">Loading frameworks...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>{isEdit ? `Edit Model: ${model.name}` : 'Create New Model'}</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">Model Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-input"
              placeholder="my-model"
              required
              disabled={isEdit} // Can't change name when editing
            />
            {!isEdit && (
              <small style={{ color: '#6b7280' }}>
                Lowercase letters, numbers, and hyphens only
              </small>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Framework *</label>
            <select
              name="framework"
              value={formData.framework}
              onChange={handleChange}
              className="form-select"
              required
            >
              <option value="">Select framework</option>
              {frameworks.map(fw => (
                <option key={fw.name} value={fw.name}>
                  {fw.name} - {fw.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Namespace selection for admin users */}
        {user?.isAdmin && (
          <div className="form-group">
            <label className="form-label">Namespace (Tenant) *</label>
            <select
              name="namespace"
              value={formData.namespace}
              onChange={handleChange}
              className="form-select"
              required
            >
              <option value="">Select namespace</option>
              {tenants.map(tenant => (
                <option key={tenant.name} value={tenant.name}>
                  {tenant.name} - {tenant.status}
                </option>
              ))}
            </select>
            <small style={{ color: '#6b7280' }}>
              Select the tenant namespace where this model will be deployed
            </small>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Storage URI *</label>
          <input
            type="text"
            name="storageUri"
            value={formData.storageUri}
            onChange={handleChange}
            className="form-input"
            placeholder={storageUriExamples[formData.framework] || 'gs://your-bucket/path/to/model'}
            required
          />
          <small style={{ color: '#6b7280' }}>
            {formData.framework && storageUriExamples[formData.framework] && (
              <>Example: {storageUriExamples[formData.framework]}</>
            )}
          </small>
        </div>

        <div className="grid grid-3">
          <div className="form-group">
            <label className="form-label">Min Replicas</label>
            <input
              type="number"
              name="minReplicas"
              value={formData.minReplicas}
              onChange={handleChange}
              className="form-input"
              min="0"
              max="10"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Replicas</label>
            <input
              type="number"
              name="maxReplicas"
              value={formData.maxReplicas}
              onChange={handleChange}
              className="form-input"
              min="1"
              max="20"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Scale Target</label>
            <input
              type="number"
              name="scaleTarget"
              value={formData.scaleTarget}
              onChange={handleChange}
              className="form-input"
              min="1"
              max="1000"
            />
            <small style={{ color: '#6b7280' }}>
              Target {formData.scaleMetric} for autoscaling
            </small>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Scale Metric</label>
          <select
            name="scaleMetric"
            value={formData.scaleMetric}
            onChange={handleChange}
            className="form-select"
          >
            <option value="concurrency">Concurrency</option>
            <option value="rps">RPS (Requests per Second)</option>
            <option value="cpu">CPU</option>
            <option value="memory">Memory</option>
          </select>
        </div>

        <div className="modal-actions">
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEdit ? 'Update Model' : 'Create Model')}
          </button>
        </div>
      </form>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Tips:
        </h3>
        <ul style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '1rem' }}>
          <li>Min replicas = 0 enables scale-to-zero</li>
          <li>Scale target determines when to add more replicas</li>
          <li>Storage URI should point to your model artifacts</li>
          <li>Use GCS (gs://), S3 (s3://), or HTTP(S) URLs</li>
        </ul>
      </div>
    </div>
  );
};

export default ModelForm;