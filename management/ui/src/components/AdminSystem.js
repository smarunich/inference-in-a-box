import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import { RefreshCw, Server, Package, Activity, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const AdminSystem = () => {
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const fetchSystemInfo = async () => {
    try {
      setLoading(true);
      const response = await api.getSystemInfo();
      setSystemInfo(response.data);
    } catch (error) {
      toast.error('Failed to fetch system information');
      console.error('Error fetching system info:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'ready':
      case 'true':
      case 'active':
        return <CheckCircle size={16} color="#10b981" />;
      case 'not ready':
      case 'false':
      case 'failed':
        return <XCircle size={16} color="#ef4444" />;
      default:
        return <AlertCircle size={16} color="#f59e0b" />;
    }
  };

  const formatResource = (resource) => {
    if (!resource) return 'N/A';
    
    // Handle memory (convert from Ki to readable format)
    if (resource.includes('Ki')) {
      const value = parseInt(resource.replace('Ki', ''));
      if (value > 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)}Gi`;
      } else if (value > 1024) {
        return `${(value / 1024).toFixed(1)}Mi`;
      }
      return resource;
    }
    
    // Handle CPU (convert from millicores)
    if (resource.includes('m')) {
      const value = parseInt(resource.replace('m', ''));
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}`;
      }
      return resource;
    }
    
    return resource;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">Loading system information...</div>
      </div>
    );
  }

  if (!systemInfo) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Failed to load system information</h3>
          <button className="btn btn-primary" onClick={fetchSystemInfo}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>System Overview</h2>
        <button className="btn btn-secondary btn-sm" onClick={fetchSystemInfo}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Nodes Section */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Server size={20} color="#3b82f6" />
            <h3>Cluster Nodes ({systemInfo.nodes.length})</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {systemInfo.nodes.map(node => (
              <div key={node.name} style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: '500' }}>{node.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getStatusIcon(node.status)}
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{node.status}</span>
                  </div>
                </div>
                
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Version: {node.version}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '500' }}>CPU</div>
                    <div style={{ fontSize: '0.875rem' }}>{formatResource(node.capacity?.cpu || 'N/A')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '500' }}>Memory</div>
                    <div style={{ fontSize: '0.875rem' }}>{formatResource(node.capacity?.memory || 'N/A')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Namespaces Section */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Package size={20} color="#10b981" />
            <h3>Namespaces ({systemInfo.namespaces.length})</h3>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {systemInfo.namespaces.map(ns => (
                <div key={ns.name} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '4px'
                }}>
                  <div>
                    <div style={{ fontWeight: '500' }}>{ns.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {new Date(ns.created).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getStatusIcon(ns.status)}
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{ns.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deployments Section */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Activity size={20} color="#8b5cf6" />
            <h3>Deployments ({systemInfo.deployments.length})</h3>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {systemInfo.deployments.map(dep => (
                <div key={`${dep.namespace}-${dep.name}`} style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ fontWeight: '500' }}>{dep.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {dep.ready}/{dep.replicas}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {dep.namespace}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {dep.ready === dep.replicas && dep.replicas > 0 
                        ? <CheckCircle size={12} color="#10b981" />
                        : <AlertCircle size={12} color="#f59e0b" />
                      }
                      <span style={{ fontSize: '0.75rem' }}>
                        {dep.available} available
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Summary */}
      <div className="card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>System Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#0369a1' }}>
              {systemInfo.nodes.filter(n => n.status === 'Ready').length}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#075985' }}>Ready Nodes</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#15803d' }}>
              {systemInfo.namespaces.filter(ns => ns.status === 'Active').length}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#14532d' }}>Active Namespaces</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fefce8', borderRadius: '6px' }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#ca8a04' }}>
              {systemInfo.deployments.filter(d => d.ready === d.replicas && d.replicas > 0).length}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#a16207' }}>Healthy Deployments</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fdf2f8', borderRadius: '6px' }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#be185d' }}>
              {systemInfo.deployments.reduce((sum, d) => sum + d.replicas, 0)}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#9d174d' }}>Total Replicas</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSystem;