import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import axios from 'axios';

const Login = () => {
  const [tokens, setTokens] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState('');
  const { login } = useAuth();

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

  const handleLogin = () => {
    if (!selectedTenant || !tokens[selectedTenant]) {
      toast.error('Please select a tenant');
      return;
    }

    const token = tokens[selectedTenant];
    login(token);
    toast.success(`Logged in as ${selectedTenant}`);
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
          Select a tenant to access the management interface
        </p>
        
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

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={!selectedTenant}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Login
        </button>

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
      </div>
    </div>
  );
};

export default Login;