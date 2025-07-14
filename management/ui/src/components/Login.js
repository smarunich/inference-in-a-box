import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import axios from 'axios';

const Login = () => {
  const [tokens, setTokens] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [loginType, setLoginType] = useState('tenant'); // 'tenant' or 'admin'
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const { login } = useAuth();
  const api = useApi();

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const response = await axios.get('/api/tokens');
      setTokens(response.data);
      setSelectedTenant(Object.keys(response.data)[0] || '');
    } catch (error) {
      toast.error('Failed to fetch tokens');
      console.error('Error fetching tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loginType === 'tenant') {
      if (!selectedTenant || !tokens[selectedTenant]) {
        toast.error('Please select a tenant');
        return;
      }

      const token = tokens[selectedTenant];
      login(token);
      toast.success(`Logged in as ${selectedTenant}`);
    } else {
      if (!adminCredentials.username || !adminCredentials.password) {
        toast.error('Please enter admin credentials');
        return;
      }

      try {
        console.log('Attempting admin login with:', adminCredentials);
        const response = await api.adminLogin(adminCredentials);
        console.log('Admin login response:', response.data);
        login(response.data.token);
        toast.success('Logged in as Super Admin');
      } catch (error) {
        console.error('Admin login error:', error);
        toast.error('Invalid admin credentials');
      }
    }
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="loading">Loading tokens...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">AI Model Management</h1>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '1.5rem' }}>
          Choose your login method to access the management interface
        </p>

        {/* Login Type Selection */}
        <div className="form-group">
          <label className="form-label">Login Type</label>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="loginType"
                value="tenant"
                checked={loginType === 'tenant'}
                onChange={(e) => setLoginType(e.target.value)}
                style={{ marginRight: '0.5rem' }}
              />
              Tenant Access
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="loginType"
                value="admin"
                checked={loginType === 'admin'}
                onChange={(e) => setLoginType(e.target.value)}
                style={{ marginRight: '0.5rem' }}
              />
              Admin Access
            </label>
          </div>
        </div>

        {/* Tenant Login */}
        {loginType === 'tenant' && (
          <div className="form-group">
            <label className="form-label">Tenant</label>
            <select
              className="form-select"
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
            >
              <option value="">Select a tenant</option>
              {Object.keys(tokens).map(tenant => (
                <option key={tenant} value={tenant}>
                  {tenant}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Admin Login */}
        {loginType === 'admin' && (
          <>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={adminCredentials.username}
                onChange={(e) => setAdminCredentials(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter admin username"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={adminCredentials.password}
                onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter admin password"
              />
            </div>
          </>
        )}

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={loginType === 'tenant' ? !selectedTenant : !adminCredentials.username || !adminCredentials.password}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loginType === 'tenant' ? 'Login as Tenant' : 'Login as Admin'}
        </button>

        {/* Information Panel */}
        {loginType === 'tenant' && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Available Tenants:
            </h3>
            <ul style={{ fontSize: '0.875rem', color: '#6b7280', listStyle: 'none' }}>
              {Object.keys(tokens).map(tenant => (
                <li key={tenant} style={{ marginBottom: '0.25rem' }}>
                  • {tenant}
                </li>
              ))}
            </ul>
          </div>
        )}

        {loginType === 'admin' && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Admin Access Features:
            </h3>
            <ul style={{ fontSize: '0.875rem', color: '#92400e', listStyle: 'none' }}>
              <li style={{ marginBottom: '0.25rem' }}>• View all models across all tenants</li>
              <li style={{ marginBottom: '0.25rem' }}>• System monitoring and logs</li>
              <li style={{ marginBottom: '0.25rem' }}>• Cluster resource management</li>
              <li style={{ marginBottom: '0.25rem' }}>• Advanced troubleshooting tools</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;