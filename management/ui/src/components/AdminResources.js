import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import { RefreshCw, Box, Globe, Network, CheckCircle, XCircle, AlertCircle, ArrowRight, Zap, Shield } from 'lucide-react';

const AdminResources = () => {
  const [resources, setResources] = useState({
    pods: [],
    services: [],
    gateways: [],
    httpRoutes: [],
    virtualServices: [],
    istioGateways: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pods');
  const api = useApi();

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const response = await api.getResources();
      setResources(response.data || {
        pods: [],
        services: [],
        gateways: [],
        httpRoutes: [],
        virtualServices: [],
        istioGateways: []
      });
    } catch (error) {
      toast.error('Failed to fetch resources');
      console.error('Error fetching resources:', error);
      setResources({
        pods: [],
        services: [],
        gateways: [],
        httpRoutes: [],
        virtualServices: [],
        istioGateways: []
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status, ready) => {
    if (ready === true || status === 'Running') {
      return <CheckCircle size={16} color="#10b981" />;
    } else if (ready === false || status === 'Failed') {
      return <XCircle size={16} color="#ef4444" />;
    } else {
      return <AlertCircle size={16} color="#f59e0b" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">Loading cluster resources...</div>
      </div>
    );
  }

  if (!resources) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Failed to load resources</h3>
          <button className="btn btn-primary" onClick={fetchResources}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'pods', label: 'Pods', icon: Box, data: (resources && resources.pods) || [] },
    { id: 'services', label: 'Services', icon: Network, data: (resources && resources.services) || [] },
    { id: 'gateways', label: 'Gateways', icon: Globe, data: (resources && resources.gateways) || [] },
    { id: 'httproutes', label: 'HTTP Routes', icon: ArrowRight, data: (resources && resources.httpRoutes) || [] },
    { id: 'virtualservices', label: 'Virtual Services', icon: Zap, data: (resources && resources.virtualServices) || [] },
    { id: 'istiogateways', label: 'Istio Gateways', icon: Shield, data: (resources && resources.istioGateways) || [] },
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Cluster Resources</h2>
        <button className="btn btn-secondary btn-sm" onClick={fetchResources}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#0369a1' }}>
            {((resources && resources.pods) || []).filter(p => p && p.ready).length}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#075985' }}>Ready Pods</div>
        </div>
        
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#15803d' }}>
            {((resources && resources.services) || []).length}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#14532d' }}>Services</div>
        </div>
        
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fefce8', borderRadius: '6px' }}>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#ca8a04' }}>
            {((resources && resources.gateways) || []).length + ((resources && resources.istioGateways) || []).length}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#a16207' }}>Gateways</div>
        </div>
        
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#0369a1' }}>
            {((resources && resources.httpRoutes) || []).length + ((resources && resources.virtualServices) || []).length}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#075985' }}>Routes</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="nav-tabs" style={{ marginBottom: '1.5rem' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Icon size={16} />
              {tab.label} ({tab.data.length})
            </button>
          );
        })}
      </nav>

      {/* Pods Tab */}
      {activeTab === 'pods' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Namespace</th>
                <th>Status</th>
                <th>Ready</th>
                <th>Restarts</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {((resources && resources.pods) || []).map(pod => (
                <tr key={`${pod.namespace}-${pod.name}`}>
                  <td>
                    <div style={{ fontWeight: '500' }}>{pod.name}</div>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      backgroundColor: '#f3f4f6', 
                      borderRadius: '4px', 
                      fontSize: '0.875rem' 
                    }}>
                      {pod.namespace}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getStatusIcon(pod.status, pod.ready)}
                      <span>{pod.status}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ 
                      color: pod.ready ? '#10b981' : '#ef4444',
                      fontWeight: '500'
                    }}>
                      {pod.ready ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span style={{ 
                      color: pod.restarts > 0 ? '#f59e0b' : '#6b7280',
                      fontWeight: pod.restarts > 0 ? '500' : 'normal'
                    }}>
                      {pod.restarts}
                    </span>
                  </td>
                  <td>{formatDate(pod.created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Namespace</th>
                <th>Type</th>
                <th>Cluster IP</th>
                <th>Ports</th>
              </tr>
            </thead>
            <tbody>
              {((resources && resources.services) || []).map(service => (
                <tr key={`${service.namespace}-${service.name}`}>
                  <td>
                    <div style={{ fontWeight: '500' }}>{service.name}</div>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      backgroundColor: '#f3f4f6', 
                      borderRadius: '4px', 
                      fontSize: '0.875rem' 
                    }}>
                      {service.namespace}
                    </span>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      backgroundColor: service.type === 'ClusterIP' ? '#dbeafe' : '#fef3c7', 
                      borderRadius: '4px', 
                      fontSize: '0.875rem',
                      color: service.type === 'ClusterIP' ? '#1e40af' : '#92400e'
                    }}>
                      {service.type}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.875rem' }}>{service.clusterIP}</code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {service.ports?.map((port, idx) => (
                        <span key={idx} style={{ 
                          padding: '0.125rem 0.25rem', 
                          backgroundColor: '#f3f4f6', 
                          borderRadius: '3px', 
                          fontSize: '0.75rem' 
                        }}>
                          {port.port}
                          {port.protocol && port.protocol !== 'TCP' && `/${port.protocol}`}
                        </span>
                      )) || 'None'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gateways Tab */}
      {activeTab === 'gateways' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Namespace</th>
                <th>Gateway Class</th>
                <th>Listeners</th>
                <th>Addresses</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {((resources && resources.gateways) || []).length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    No Gateway API gateways found
                  </td>
                </tr>
              ) : (
                ((resources && resources.gateways) || []).map(gateway => (
                  <tr key={`${gateway.namespace}-${gateway.name}`}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{gateway.name}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}>
                        {gateway.namespace}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#dbeafe',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        color: '#1e40af'
                      }}>
                        {gateway.gatewayClass || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {gateway.listeners?.map((listener, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.25rem',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            color: '#1e40af'
                          }}>
                            {listener}
                          </span>
                        )) || 'None'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {gateway.addresses?.map((address, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.25rem',
                            backgroundColor: '#f0fdf4',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            color: '#15803d'
                          }}>
                            {address}
                          </span>
                        )) || 'Pending'}
                      </div>
                    </td>
                    <td>{formatDate(gateway.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* HTTP Routes Tab */}
      {activeTab === 'httproutes' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Namespace</th>
                <th>Hostnames</th>
                <th>Parent Refs</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {((resources && resources.httpRoutes) || []).length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    No HTTP routes found
                  </td>
                </tr>
              ) : (
                ((resources && resources.httpRoutes) || []).map(route => (
                  <tr key={`${route.namespace}-${route.name}`}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{route.name}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}>
                        {route.namespace}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {route.hostnames?.map((hostname, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.25rem',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            color: '#1e40af'
                          }}>
                            {hostname}
                          </span>
                        )) || 'None'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {route.parentRefs?.map((ref, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.25rem',
                            backgroundColor: '#fef3c7',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            color: '#92400e'
                          }}>
                            {ref}
                          </span>
                        )) || 'None'}
                      </div>
                    </td>
                    <td>{formatDate(route.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Virtual Services Tab */}
      {activeTab === 'virtualservices' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Namespace</th>
                <th>Hosts</th>
                <th>Gateways</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {((resources && resources.virtualServices) || []).length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    No Istio virtual services found
                  </td>
                </tr>
              ) : (
                ((resources && resources.virtualServices) || []).map(vs => (
                  <tr key={`${vs.namespace}-${vs.name}`}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{vs.name}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}>
                        {vs.namespace}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {vs.hosts?.map((host, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.25rem',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            color: '#1e40af'
                          }}>
                            {host}
                          </span>
                        )) || 'None'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {vs.gateways?.map((gateway, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.25rem',
                            backgroundColor: '#fef3c7',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            color: '#92400e'
                          }}>
                            {gateway}
                          </span>
                        )) || 'None'}
                      </div>
                    </td>
                    <td>{formatDate(vs.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Istio Gateways Tab */}
      {activeTab === 'istiogateways' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Namespace</th>
                <th>Servers</th>
                <th>Selector</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {((resources && resources.istioGateways) || []).length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    No Istio gateways found
                  </td>
                </tr>
              ) : (
                ((resources && resources.istioGateways) || []).map(gateway => (
                  <tr key={`${gateway.namespace}-${gateway.name}`}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{gateway.name}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}>
                        {gateway.namespace}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {gateway.servers?.map((server, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.25rem',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            color: '#1e40af'
                          }}>
                            {server}
                          </span>
                        )) || 'None'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {Object.entries(gateway.selector || {}).map(([key, value], idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.25rem',
                            backgroundColor: '#f0fdf4',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            color: '#15803d'
                          }}>
                            {key}={value}
                          </span>
                        ))}
                        {Object.keys(gateway.selector || {}).length === 0 && 'None'}
                      </div>
                    </td>
                    <td>{formatDate(gateway.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default AdminResources;