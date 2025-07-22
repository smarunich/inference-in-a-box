import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import JsonView from '@uiw/react-json-view';
import { Play, Copy, Settings, Globe, Plus, Minus, Server } from 'lucide-react';

const InferenceTest = () => {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [inputData, setInputData] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [showConnectionSettings, setShowConnectionSettings] = useState(false);
  const [aiGatewayInfo, setAiGatewayInfo] = useState(null);
  
  // Connection settings
  const [connectionSettings, setConnectionSettings] = useState({
    useCustom: false,
    host: '',
    port: '',
    path: '',
    protocol: 'http',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    dnsResolve: []
  });
  
  const api = useApi();
  const { user } = useAuth();

  useEffect(() => {
    fetchModels();
    fetchGatewayInfo();
  }, []);

  useEffect(() => {
    if (selectedModel && models.length > 0) {
      updateConnectionSettings();
    }
  }, [selectedModel, models]);

  const updateConnectionSettings = () => {
    const model = models.find(m => m.name === selectedModel);
    if (model && model.url) {
      try {
        const url = new URL(model.url);
        setConnectionSettings(prev => ({
          ...prev,
          host: url.hostname,
          port: url.port || (url.protocol === 'https:' ? '443' : '80'),
          path: `/v1/models/${selectedModel}:predict`,
          protocol: url.protocol.replace(':', ''),
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: `Bearer ${user?.token || 'your-token-here'}` }
          ],
          dnsResolve: prev.dnsResolve || []
        }));
      } catch (error) {
        console.error('Error parsing model URL:', error);
        // Fallback to default settings
        setConnectionSettings(prev => ({
          ...prev,
          host: 'localhost',
          port: '8080',
          path: `/v1/models/${selectedModel}:predict`,
          protocol: 'http',
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: `Bearer ${user?.token || 'your-token-here'}` }
          ],
          dnsResolve: prev.dnsResolve || []
        }));
      }
    }
  };

  const fetchModels = async () => {
    try {
      const response = await api.getModels();
      const readyModels = (response.data.models || []).filter(model => model.ready);
      setModels(readyModels);
      if (readyModels.length > 0) {
        setSelectedModel(readyModels[0].name);
      }
    } catch (error) {
      toast.error('Failed to fetch models');
      console.error('Error fetching models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchGatewayInfo = async () => {
    try {
      const response = await api.getAIGatewayService();
      setAiGatewayInfo(response.data);
    } catch (error) {
      console.error('Error fetching gateway info:', error);
      setAiGatewayInfo(null);
    }
  };

  const addHeader = () => {
    setConnectionSettings(prev => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }]
    }));
  };

  const removeHeader = (index) => {
    setConnectionSettings(prev => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index)
    }));
  };

  const updateHeader = (index, field, value) => {
    setConnectionSettings(prev => ({
      ...prev,
      headers: prev.headers.map((header, i) => 
        i === index ? { ...header, [field]: value } : header
      )
    }));
  };

  const addDnsResolve = () => {
    // Get default values from current connection settings
    const defaultHost = connectionSettings.host || '';
    const defaultPort = connectionSettings.port || '443';
    const defaultAddress = aiGatewayInfo?.clusterIP || '';
    
    setConnectionSettings(prev => ({
      ...prev,
      dnsResolve: [...prev.dnsResolve, { 
        host: defaultHost, 
        port: defaultPort, 
        address: defaultAddress 
      }]
    }));
  };

  const removeDnsResolve = (index) => {
    setConnectionSettings(prev => ({
      ...prev,
      dnsResolve: prev.dnsResolve.filter((_, i) => i !== index)
    }));
  };

  const updateDnsResolve = (index, field, value) => {
    setConnectionSettings(prev => ({
      ...prev,
      dnsResolve: prev.dnsResolve.map((resolve, i) => 
        i === index ? { ...resolve, [field]: value } : resolve
      )
    }));
  };

  const buildCustomUrl = () => {
    const { protocol, host, port, path } = connectionSettings;
    const portPart = port ? `:${port}` : '';
    return `${protocol}://${host}${portPart}${path}`;
  };

  const handlePredict = async () => {
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }

    if (!inputData.trim()) {
      toast.error('Please provide input data');
      return;
    }

    try {
      const parsedInput = JSON.parse(inputData);
      setLoading(true);
      setResponse(null);

      // Always use server-side inference (from management container)
      // This ensures requests come from within the cluster
      const result = await api.predict(selectedModel, parsedInput, connectionSettings.useCustom ? connectionSettings : null);
      setResponse(result.data);
      
      toast.success('Prediction completed successfully');
    } catch (error) {
      if (error.name === 'SyntaxError') {
        toast.error('Invalid JSON input');
      } else {
        const errorMessage = error.response?.data?.error || error.message || 'Prediction failed';
        toast.error(errorMessage);
        console.error('Prediction error details:', error);
      }
      console.error('Error making prediction:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getExampleInput = (modelName) => {
    // Return example inputs based on common model names
    if (modelName.includes('iris')) {
      return {
        instances: [
          [6.8, 2.8, 4.8, 1.4],
          [6.0, 3.4, 4.5, 1.6]
        ]
      };
    }
    
    if (modelName.includes('mnist')) {
      return {
        instances: [
          {
            image: {
              b64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            }
          }
        ]
      };
    }
    
    if (modelName.includes('flowers') || modelName.includes('image')) {
      return {
        instances: [
          {
            b64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          }
        ]
      };
    }
    
    // Generic example
    return {
      instances: [
        [1, 2, 3, 4],
        [5, 6, 7, 8]
      ]
    };
  };

  const handleUseExample = () => {
    if (!selectedModel) {
      toast.error('Please select a model first');
      return;
    }
    
    const example = getExampleInput(selectedModel);
    setInputData(JSON.stringify(example, null, 2));
  };

  if (loadingModels) {
    return (
      <div className="card">
        <div className="loading">Loading models...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Test Model Inference</h2>
      
      {models.length === 0 ? (
        <div className="empty-state">
          <h3>No ready models found</h3>
          <p>Create and deploy a model first to test inference</p>
        </div>
      ) : (
        <>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Select Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="form-select"
              >
                <option value="">Choose a model</option>
                {models.map(model => (
                  <option key={model.name} value={model.name}>
                    {model.name} ({model.namespace})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Actions</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleUseExample}
                  disabled={!selectedModel}
                >
                  Use Example
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setInputData('')}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowConnectionSettings(!showConnectionSettings)}
                >
                  <Settings size={14} />
                  Connection
                </button>
              </div>
            </div>
          </div>

          {/* Connection Settings */}
          {showConnectionSettings && (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={18} />
                Connection Settings
              </h3>
              
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={connectionSettings.useCustom}
                    onChange={(e) => setConnectionSettings(prev => ({ ...prev, useCustom: e.target.checked }))}
                  />
                  Use custom connection settings
                </label>
                <small style={{ color: '#6b7280' }}>
                  When enabled, the management container will use these custom settings instead of auto-detected model URLs
                </small>
              </div>

              {connectionSettings.useCustom && (
                <>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">Protocol</label>
                      <select
                        value={connectionSettings.protocol}
                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, protocol: e.target.value }))}
                        className="form-select"
                      >
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Host</label>
                      <input
                        type="text"
                        value={connectionSettings.host}
                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, host: e.target.value }))}
                        className="form-input"
                        placeholder="localhost or model-host.example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">Port</label>
                      <input
                        type="text"
                        value={connectionSettings.port}
                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, port: e.target.value }))}
                        className="form-input"
                        placeholder="8080"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Path</label>
                      <input
                        type="text"
                        value={connectionSettings.path}
                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, path: e.target.value }))}
                        className="form-input"
                        placeholder="/v1/models/model-name:predict"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label">Headers</label>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={addHeader}
                      >
                        <Plus size={14} />
                        Add Header
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {connectionSettings.headers.map((header, index) => (
                        <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={header.key}
                            onChange={(e) => updateHeader(index, 'key', e.target.value)}
                            className="form-input"
                            placeholder="Header name"
                            style={{ flex: 1 }}
                          />
                          <input
                            type="text"
                            value={header.value}
                            onChange={(e) => updateHeader(index, 'value', e.target.value)}
                            className="form-input"
                            placeholder="Header value"
                            style={{ flex: 2 }}
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeHeader(index)}
                            disabled={connectionSettings.headers.length === 1}
                          >
                            <Minus size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label">
                        <Server size={14} style={{ marginRight: '0.25rem', display: 'inline' }} />
                        DNS Resolution (like curl --resolve)
                      </label>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={addDnsResolve}
                      >
                        <Plus size={14} />
                        Add DNS Override
                      </button>
                    </div>
                    <small style={{ color: '#6b7280', marginBottom: '0.5rem', display: 'block' }}>
                      Override DNS resolution for testing. Click "Add DNS Override" to route traffic through the gateway for published models.
                    </small>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {connectionSettings.dnsResolve.length === 0 ? (
                        <div style={{ 
                          padding: '0.75rem', 
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          textAlign: 'center',
                          fontStyle: 'italic',
                          backgroundColor: '#f9fafb',
                          border: '1px dashed #d1d5db',
                          borderRadius: '6px'
                        }}>
                          {aiGatewayInfo?.clusterIP ? (
                            <div>
                              <div>Click "Add DNS Override" to route requests through the gateway</div>
                              <div style={{ marginTop: '0.25rem', fontSize: '0.625rem', color: '#9ca3af' }}>
                                (Will use hostname from connection settings and gateway IP)
                              </div>
                            </div>
                          ) : (
                            <div>Loading gateway information...</div>
                          )}
                        </div>
                      ) : (
                        connectionSettings.dnsResolve.map((resolve, index) => {
                          const isHostDefault = resolve.host === connectionSettings.host && resolve.host !== '';
                          const isPortDefault = resolve.port === (connectionSettings.port || '443') && resolve.port !== '';
                          const isAddressDefault = resolve.address === aiGatewayInfo?.clusterIP && resolve.address !== '';
                          const hasDefaults = isHostDefault || isPortDefault || isAddressDefault;

                          return (
                            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={resolve.host}
                                  onChange={(e) => updateDnsResolve(index, 'host', e.target.value)}
                                  className="form-input"
                                  placeholder="Host (e.g., api.router.inference-in-a-box)"
                                  style={{ 
                                    flex: 2,
                                    ...(isHostDefault && {
                                      backgroundColor: '#f9fafb',
                                      fontStyle: 'italic',
                                      color: '#6b7280'
                                    })
                                  }}
                                />
                                <input
                                  type="text"
                                  value={resolve.port}
                                  onChange={(e) => updateDnsResolve(index, 'port', e.target.value)}
                                  className="form-input"
                                  placeholder="Port (e.g., 443)"
                                  style={{ 
                                    flex: 1,
                                    ...(isPortDefault && {
                                      backgroundColor: '#f9fafb',
                                      fontStyle: 'italic',
                                      color: '#6b7280'
                                    })
                                  }}
                                />
                                <input
                                  type="text"
                                  value={resolve.address}
                                  onChange={(e) => updateDnsResolve(index, 'address', e.target.value)}
                                  className="form-input"
                                  placeholder="Gateway IP (auto-detected)"
                                  style={{ 
                                    flex: 2,
                                    ...(isAddressDefault && {
                                      backgroundColor: '#f9fafb',
                                      fontStyle: 'italic',
                                      color: '#6b7280'
                                    })
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => removeDnsResolve(index)}
                                >
                                  <Minus size={14} />
                                </button>
                              </div>
                              {hasDefaults && (
                                <div style={{ 
                                  fontSize: '0.625rem', 
                                  color: '#9ca3af', 
                                  fontStyle: 'italic',
                                  paddingLeft: '0.5rem'
                                }}>
                                  Using default values (can be customized)
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Full URL Preview</label>
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: '#e5e7eb', 
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      wordBreak: 'break-all'
                    }}>
                      {buildCustomUrl()}
                      {connectionSettings.dnsResolve.length > 0 && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#4b5563' }}>
                          <strong>DNS Overrides:</strong>
                          {connectionSettings.dnsResolve.map((resolve, index) => (
                            resolve.host && resolve.port && resolve.address && (
                              <div key={index}>→ {resolve.host}:{resolve.port} will resolve to {resolve.address}:{resolve.port}</div>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Input Data (JSON)</label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(inputData)}
                disabled={!inputData}
              >
                <Copy size={14} />
                Copy
              </button>
            </div>
            <textarea
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              className="form-textarea"
              placeholder='{"instances": [[1, 2, 3, 4]]}'
              rows="8"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={handlePredict}
              className="btn btn-primary"
              disabled={loading || !selectedModel || !inputData.trim()}
            >
              <Play size={16} />
              {loading ? 'Making Prediction...' : 'Run Prediction'}
            </button>
          </div>

          {response && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Response</label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyToClipboard(JSON.stringify(response, null, 2))}
                >
                  <Copy size={14} />
                  Copy Response
                </button>
              </div>
              <div style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '6px', 
                padding: '1rem',
                backgroundColor: '#f8fafc'
              }}>
                <JsonView
                  value={response}
                  collapsed={false}
                  style={{ fontSize: '0.875rem' }}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Common Input Formats:
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              <p><strong>Sklearn/XGBoost:</strong> <code>{`{"instances": [[1, 2, 3, 4]]}`}</code></p>
              <p><strong>TensorFlow:</strong> <code>{`{"instances": [{"input": [1, 2, 3, 4]}]}`}</code></p>
              <p><strong>PyTorch:</strong> <code>{`{"instances": [{"data": [1, 2, 3, 4]}]}`}</code></p>
              <p><strong>Images:</strong> <code>{`{"instances": [{"b64": "base64-encoded-image"}]}`}</code></p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InferenceTest;