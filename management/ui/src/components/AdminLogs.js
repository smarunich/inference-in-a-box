import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import { RefreshCw, Download, Search, Filter, Copy } from 'lucide-react';

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    namespace: '',
    component: '',
    lines: 100
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [tenants, setTenants] = useState([]);
  const api = useApi();

  useEffect(() => {
    fetchTenants();
    fetchLogs();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await api.getTenants();
      setTenants(response.data.tenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.getAdminLogs(filters);
      setLogs(response.data.logs);
    } catch (error) {
      toast.error('Failed to fetch logs');
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    fetchLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      namespace: '',
      component: '',
      lines: 100
    });
    setSearchTerm('');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadLogs = () => {
    const filteredLogs = logs.filter(log => 
      log.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const logsText = filteredLogs.join('\n');
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cluster-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Logs downloaded');
  };

  const filteredLogs = logs.filter(log => 
    log.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const commonComponents = [
    'management-service',
    'jwt-server',
    'kserve-controller',
    'istio-proxy',
    'knative-serving'
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>System Logs</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={downloadLogs}
            disabled={logs.length === 0}
          >
            <Download size={16} />
            Download
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={18} />
          Filters
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Namespace</label>
            <select
              className="form-select"
              value={filters.namespace}
              onChange={(e) => handleFilterChange('namespace', e.target.value)}
            >
              <option value="">All Namespaces</option>
              {tenants.map(tenant => (
                <option key={tenant.name} value={tenant.name}>
                  {tenant.name}
                </option>
              ))}
              <option value="default">default</option>
              <option value="kserve">kserve</option>
              <option value="istio-system">istio-system</option>
              <option value="knative-serving">knative-serving</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Component</label>
            <select
              className="form-select"
              value={filters.component}
              onChange={(e) => handleFilterChange('component', e.target.value)}
            >
              <option value="">All Components</option>
              {commonComponents.map(component => (
                <option key={component} value={component}>
                  {component}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Lines</label>
            <select
              className="form-select"
              value={filters.lines}
              onChange={(e) => handleFilterChange('lines', parseInt(e.target.value))}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-primary btn-sm" onClick={handleApplyFilters}>
            Apply Filters
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <label className="form-label">Search Logs</label>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ 
            position: 'absolute', 
            left: '0.75rem', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: '#6b7280'
          }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search in logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      {/* Logs Display */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>
            Logs ({filteredLogs.length} 
            {searchTerm && ` filtered from ${logs.length}`})
          </h3>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => copyToClipboard(filteredLogs.join('\n'))}
            disabled={filteredLogs.length === 0}
          >
            <Copy size={16} />
            Copy All
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <h3>No logs found</h3>
            <p>Try adjusting your filters or refresh the logs</p>
          </div>
        ) : (
          <div 
            className="code-block" 
            style={{ 
              maxHeight: '600px', 
              overflowY: 'auto',
              backgroundColor: '#1f2937',
              color: '#f9fafb',
              padding: '1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            }}
          >
            {filteredLogs.map((log, index) => (
              <div 
                key={index} 
                style={{ 
                  marginBottom: '0.25rem',
                  padding: '0.125rem 0',
                  borderBottom: index < filteredLogs.length - 1 ? '1px solid #374151' : 'none'
                }}
              >
                <span style={{ 
                  color: '#9ca3af', 
                  fontSize: '0.75rem',
                  marginRight: '0.5rem'
                }}>
                  {String(index + 1).padStart(4, '0')}
                </span>
                <span style={{ 
                  color: log.includes('ERROR') ? '#fca5a5' : 
                        log.includes('WARN') ? '#fcd34d' : 
                        log.includes('INFO') ? '#93c5fd' : '#f9fafb'
                }}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Statistics */}
      {logs.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Log Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#dc2626' }}>
                {logs.filter(log => log.includes('ERROR')).length}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#991b1b' }}>Errors</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fefce8', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ca8a04' }}>
                {logs.filter(log => log.includes('WARN')).length}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#a16207' }}>Warnings</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#2563eb' }}>
                {logs.filter(log => log.includes('INFO')).length}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#1d4ed8' }}>Info</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#16a34a' }}>
                {logs.length}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#15803d' }}>Total Lines</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogs;