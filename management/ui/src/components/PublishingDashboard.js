import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import { Plus, Globe, Activity, TrendingUp, Users, AlertCircle } from 'lucide-react';
import PublishingList from './PublishingList';
import PublishingForm from './PublishingForm';

const PublishingDashboard = () => {
  const [models, setModels] = useState([]);
  const [publishedModels, setPublishedModels] = useState([]);
  const [publishingModel, setPublishingModel] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalPublished: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    activeUsers: 0
  });
  const api = useApi();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [modelsResponse, publishedResponse] = await Promise.all([
        api.getModels(),
        api.getPublishedModels()
      ]);

      setModels(modelsResponse.data.models || []);
      setPublishedModels(publishedResponse.data.publishedModels || []);
      
      // Calculate stats
      const published = publishedResponse.data.publishedModels || [];
      const totalRequests = published.reduce((sum, model) => sum + (model.usage?.totalRequests || 0), 0);
      const totalTokens = published.reduce((sum, model) => sum + (model.usage?.totalTokens || 0), 0);
      
      setStats({
        totalPublished: published.length,
        totalRequests,
        totalTokens,
        activeModels: published.filter(m => m.status === 'active').length
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch dashboard data');
    }
  };

  const handlePublishModel = (modelName) => {
    setPublishingModel(modelName);
    setActiveTab('publish');
  };

  const handlePublishComplete = (publishedModel) => {
    setPublishingModel(null);
    setActiveTab('published');
    fetchData(); // Refresh data
    
    if (publishedModel) {
      toast.success('Model published successfully!');
    }
  };

  const getReadyModels = () => {
    return models.filter(model => model.ready && !isModelPublished(model.name));
  };

  const isModelPublished = (modelName) => {
    return publishedModels.some(pm => pm.modelName === modelName);
  };

  const renderOverview = () => (
    <div>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#3b82f6', marginBottom: '0.5rem' }}>
            {stats.totalPublished}
          </div>
          <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Globe size={16} />
            Published Models
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#10b981', marginBottom: '0.5rem' }}>
            {stats.activeModels}
          </div>
          <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Activity size={16} />
            Active Models
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#8b5cf6', marginBottom: '0.5rem' }}>
            {stats.totalRequests.toLocaleString()}
          </div>
          <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} />
            Total Requests
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#f59e0b', marginBottom: '0.5rem' }}>
            {stats.totalTokens?.toLocaleString() || 0}
          </div>
          <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Users size={16} />
            Total Tokens
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Quick Actions</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h4 style={{ marginBottom: '0.5rem' }}>Ready to Publish</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {getReadyModels().length > 0 ? (
                getReadyModels().map(model => (
                  <button
                    key={model.name}
                    className="btn btn-primary btn-sm"
                    onClick={() => handlePublishModel(model.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Plus size={14} />
                    Publish {model.name}
                  </button>
                ))
              ) : (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#f8fafc', 
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#6b7280'
                }}>
                  <AlertCircle size={16} />
                  No models ready for publishing
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: '0.5rem' }}>Recently Published</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {publishedModels.slice(0, 3).map(model => (
                <div 
                  key={`${model.tenantID}-${model.modelName}`}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.5rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '4px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500' }}>{model.modelName}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {model.usage?.totalRequests || 0} requests
                    </div>
                  </div>
                  <div style={{ 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px',
                    backgroundColor: model.status === 'active' ? '#dcfce7' : '#fef2f2',
                    color: model.status === 'active' ? '#166534' : '#dc2626',
                    fontSize: '0.75rem'
                  }}>
                    {model.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPublishForm = () => (
    <div>
      {publishingModel ? (
        <PublishingForm 
          modelName={publishingModel}
          onComplete={handlePublishComplete}
          onCancel={() => {
            setPublishingModel(null);
            setActiveTab('overview');
          }}
        />
      ) : (
        <div className="card">
          <h3>Select a Model to Publish</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {getReadyModels().map(model => (
              <div 
                key={model.name}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              >
                <div>
                  <div style={{ fontWeight: '500' }}>{model.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {model.namespace} • Ready
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handlePublishModel(model.name)}
                >
                  Publish
                </button>
              </div>
            ))}
            {getReadyModels().length === 0 && (
              <div style={{ 
                padding: '2rem', 
                textAlign: 'center', 
                color: '#6b7280' 
              }}>
                No models available for publishing
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Tab Navigation */}
      <div className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`nav-tab ${activeTab === 'published' ? 'active' : ''}`}
          onClick={() => setActiveTab('published')}
        >
          Published Models
        </button>
        <button
          className={`nav-tab ${activeTab === 'publish' ? 'active' : ''}`}
          onClick={() => setActiveTab('publish')}
        >
          Publish Model
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'published' && <PublishingList />}
      {activeTab === 'publish' && renderPublishForm()}
    </div>
  );
};

export default PublishingDashboard;