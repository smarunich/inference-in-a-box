import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  Play, 
  Code, 
  Terminal, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Globe,
  Key,
  Settings,
  X,
  RefreshCw
} from 'lucide-react';

const DeveloperConsole = () => {
  const [publishedModels, setPublishedModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(null);
  const [testRequest, setTestRequest] = useState('');
  const [testResponse, setTestResponse] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testHistory, setTestHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('test');
  
  // Advanced customization state
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customHeaders, setCustomHeaders] = useState([{ key: 'Content-Type', value: 'application/json' }]);
  const [customMethod, setCustomMethod] = useState('POST');
  const [useCustomConfig, setUseCustomConfig] = useState(false);
  const [requestPresets, setRequestPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  
  // AI Gateway service state
  const [aiGatewayService, setAIGatewayService] = useState(null);
  
  const api = useApi();
  const { user } = useAuth();

  useEffect(() => {
    fetchPublishedModels();
    fetchTestHistory();
    fetchAIGatewayService();
  }, []);

  const fetchTestHistory = async () => {
    try {
      const response = await api.getTestHistory();
      setTestHistory(response.data.tests || []);
    } catch (error) {
      console.error('Error fetching test history:', error);
      // Don't show error toast for test history as it's not critical
    }
  };

  const fetchAIGatewayService = async () => {
    try {
      const response = await api.getAIGatewayService();
      setAIGatewayService(response.data);
    } catch (error) {
      console.error('Error fetching AI Gateway service:', error);
      // Don't show error toast as this is not critical for basic functionality
    }
  };

  const fetchPublishedModels = async () => {
    try {
      setLoading(true);
      const response = await api.getPublishedModels();
      const models = response.data.publishedModels || [];
      setPublishedModels(models);
      if (models.length > 0 && !selectedModel) {
        setSelectedModel(models[0]);
        generateSampleRequest(models[0]);
        initializeRequestPresets();
      }
    } catch (error) {
      toast.error('Failed to fetch published models');
      console.error('Error fetching published models:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleRequest = (model) => {
    const sampleData = model.modelType === 'openai' 
      ? {
          model: model.modelName,
          messages: [
            { role: "user", content: "Hello! This is a test message from the developer console." }
          ],
          max_tokens: 100,
          temperature: 0.7
        }
      : {
          inputs: [[5.1, 3.5, 1.4, 0.2]]
        };
    
    setTestRequest(JSON.stringify(sampleData, null, 2));
  };

  const initializeRequestPresets = () => {
    if (!selectedModel) return;
    
    const presets = selectedModel.modelType === 'openai' ? [
      {
        name: 'Simple Chat',
        description: 'Basic chat completion',
        data: {
          model: selectedModel.modelName,
          messages: [{ role: "user", content: "Hello!" }],
          max_tokens: 100,
          temperature: 0.7
        }
      },
      {
        name: 'System Prompt',
        description: 'Chat with system instructions',
        data: {
          model: selectedModel.modelName,
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Explain quantum computing in simple terms." }
          ],
          max_tokens: 200,
          temperature: 0.3
        }
      },
      {
        name: 'Creative Writing',
        description: 'High temperature for creative tasks',
        data: {
          model: selectedModel.modelName,
          messages: [{ role: "user", content: "Write a short story about a robot learning to paint." }],
          max_tokens: 300,
          temperature: 0.9
        }
      }
    ] : [
      {
        name: 'Single Instance',
        description: 'Basic single prediction',
        data: {
          inputs: [[5.1, 3.5, 1.4, 0.2]]
        }
      },
      {
        name: 'Batch Prediction',
        description: 'Multiple instances',
        data: {
          inputs: [
            [5.1, 3.5, 1.4, 0.2],
            [4.9, 3.0, 1.4, 0.2],
            [4.7, 3.2, 1.3, 0.2]
          ]
        }
      }
    ];
    
    setRequestPresets(presets);
  };

  const loadPreset = (presetName) => {
    const preset = requestPresets.find(p => p.name === presetName);
    if (preset) {
      setTestRequest(JSON.stringify(preset.data, null, 2));
      setSelectedPreset(presetName);
    }
  };

  const addCustomHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const removeCustomHeader = (index) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const updateCustomHeader = (index, field, value) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  const resetCustomization = () => {
    setCustomEndpoint('');
    setCustomHeaders([{ key: 'Content-Type', value: 'application/json' }]);
    setCustomMethod('POST');
    setUseCustomConfig(false);
  };

  const handleModelChange = (modelName) => {
    const model = publishedModels.find(m => m.modelName === modelName);
    if (model) {
      setSelectedModel(model);
      generateSampleRequest(model);
      setTestResponse(null);
      initializeRequestPresets();
    }
  };

  const handleTestModel = async () => {
    if (!selectedModel || !testRequest.trim()) {
      toast.error('Please select a model and provide test data');
      return;
    }

    setTestLoading(true);

    try {
      const requestData = JSON.parse(testRequest);
      
      // Build test execution request
      const testExecutionRequest = {
        modelName: selectedModel.modelName,
        testData: requestData,
        useCustomConfig: useCustomConfig,
        customEndpoint: useCustomConfig ? customEndpoint : '',
        customMethod: useCustomConfig ? customMethod : 'POST',
        customHeaders: useCustomConfig ? customHeaders : []
      };

      // Execute test via management service
      const response = await api.executeTest(testExecutionRequest);
      const testResult = response.data;

      setTestResponse(testResult);
      
      // Add to history
      setTestHistory(prev => [testResult, ...prev.slice(0, 9)]); // Keep last 10 tests
      
      if (testResult.success) {
        toast.success(`Test completed successfully (${testResult.responseTime}ms)`);
      } else {
        toast.error(`Test failed: ${testResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.response?.data?.error || error.message,
        request: testRequest,
        endpoint: selectedModel.modelType === 'openai' 
          ? `${selectedModel.externalURL}/chat/completions`
          : `${selectedModel.externalURL}/predict`,
        status: 'Network Error',
        statusCode: error.response?.status || 0,
        responseTime: 0,
        timestamp: new Date()
      };

      setTestResponse(errorResult);
      setTestHistory(prev => [errorResult, ...prev.slice(0, 9)]);
      toast.error(`Network error: ${error.response?.data?.error || error.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const generateCurlCommand = () => {
    if (!selectedModel || !testRequest.trim()) return '';

    let endpoint;
    let headers;
    const method = useCustomConfig ? customMethod : 'POST';

    if (useCustomConfig && customEndpoint) {
      endpoint = customEndpoint;
      headers = customHeaders.filter(h => h.key && h.value).map(h => `  -H "${h.key}: ${h.value}"`).join(' \\\\\n');
    } else if (selectedModel.modelType === 'openai') {
      // OpenAI models use external URL
      endpoint = `${selectedModel.externalURL}/chat/completions`;
      headers = `  -H "Content-Type: application/json" \\\\\n  -H "X-API-Key: ${selectedModel.apiKey}"`;
    } else {
      // Traditional models use AI Gateway service IP with Host header
      if (aiGatewayService && aiGatewayService.clusterIP) {
        endpoint = `http://${aiGatewayService.clusterIP}/published/models/${selectedModel.modelName}`;
        headers = `  -H "Host: ${selectedModel.publicHostname}" \\\\\n  -H "x-api-key: ${selectedModel.apiKey}" \\\\\n  -H "Content-Type: application/json"`;
      } else {
        // Fallback to external URL if AI Gateway service not available
        endpoint = `${selectedModel.externalURL}/predict`;
        headers = `  -H "Content-Type: application/json" \\\\\n  -H "X-API-Key: ${selectedModel.apiKey}"`;
      }
    }

    return `curl -X ${method} "${endpoint}" \\\\\n${headers} \\\\\n  -d '${testRequest.replace(/'/g, "\\'")}'`;
  };

  const generatePythonCode = () => {
    if (!selectedModel || !testRequest.trim()) return '';

    let endpoint;
    let headers;
    const method = useCustomConfig ? customMethod.toLowerCase() : 'post';

    if (useCustomConfig && customEndpoint) {
      endpoint = customEndpoint;
      headers = customHeaders.filter(h => h.key && h.value).reduce((acc, h) => {
        acc[h.key] = h.value;
        return acc;
      }, {});
    } else if (selectedModel.modelType === 'openai') {
      // OpenAI models use external URL
      endpoint = `${selectedModel.externalURL}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        "X-API-Key": selectedModel.apiKey
      };
    } else {
      // Traditional models use AI Gateway service IP with Host header
      if (aiGatewayService && aiGatewayService.clusterIP) {
        endpoint = `http://${aiGatewayService.clusterIP}/published/models/${selectedModel.modelName}`;
        headers = {
          "Host": selectedModel.publicHostname,
          "x-api-key": selectedModel.apiKey,
          "Content-Type": "application/json"
        };
      } else {
        // Fallback to external URL if AI Gateway service not available
        endpoint = `${selectedModel.externalURL}/predict`;
        headers = {
          "Content-Type": "application/json",
          "X-API-Key": selectedModel.apiKey
        };
      }
    }

    const headersStr = JSON.stringify(headers, null, 4);

    return `import requests
import json

# Model endpoint
url = "${endpoint}"

# Headers
headers = ${headersStr}

# Request data
data = ${testRequest}

# Make request
response = requests.${method}(url, headers=headers, json=data)

# Check response
if response.status_code == 200:
    result = response.json()
    print("Success:", result)
else:
    print("Error:", response.status_code, response.text)`;
  };

  const generateJavaScriptCode = () => {
    if (!selectedModel || !testRequest.trim()) return '';

    let endpoint;
    let headers;
    const method = useCustomConfig ? customMethod : 'POST';

    if (useCustomConfig && customEndpoint) {
      endpoint = customEndpoint;
      headers = customHeaders.filter(h => h.key && h.value).reduce((acc, h) => {
        acc[h.key] = h.value;
        return acc;
      }, {});
    } else if (selectedModel.modelType === 'openai') {
      // OpenAI models use external URL
      endpoint = `${selectedModel.externalURL}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        "X-API-Key": selectedModel.apiKey
      };
    } else {
      // Traditional models use AI Gateway service IP with Host header
      if (aiGatewayService && aiGatewayService.clusterIP) {
        endpoint = `http://${aiGatewayService.clusterIP}/published/models/${selectedModel.modelName}`;
        headers = {
          "Host": selectedModel.publicHostname,
          "x-api-key": selectedModel.apiKey,
          "Content-Type": "application/json"
        };
      } else {
        // Fallback to external URL if AI Gateway service not available
        endpoint = `${selectedModel.externalURL}/predict`;
        headers = {
          "Content-Type": "application/json",
          "X-API-Key": selectedModel.apiKey
        };
      }
    }

    const headersStr = JSON.stringify(headers, null, 4);

    return `// Model endpoint
const url = "${endpoint}";

// Headers
const headers = ${headersStr};

// Request data
const data = ${testRequest};

// Make request
fetch(url, {
    method: '${method}',
    headers: headers,
    body: JSON.stringify(data)
})
.then(response => response.json())
.then(result => {
    console.log('Success:', result);
})
.catch(error => {
    console.error('Error:', error);
});`;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading-spinner">Loading developer console...</div>
      </div>
    );
  }

  if (publishedModels.length === 0) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <AlertCircle size={48} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
          <h3>No Published Models</h3>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            You need to publish at least one model to use the developer console.
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Go to the Models tab and publish a model to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
        <h2 className="modal-title">
          Developer Console
        </h2>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Test your published models through the local management service
        </div>
      </div>

      {/* Model Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
          Select Published Model
        </label>
        <select
          value={selectedModel?.modelName || ''}
          onChange={(e) => handleModelChange(e.target.value)}
          className="form-control"
          style={{ maxWidth: '400px' }}
        >
          {publishedModels.map(model => (
            <option key={model.modelName} value={model.modelName}>
              {model.modelName} ({model.modelType}) - {model.publicHostname}
            </option>
          ))}
        </select>
      </div>

      {selectedModel && (
        <>
          {/* Model Info */}
          <div className="form-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Globe size={18} />
              Model Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>External URL</div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  wordBreak: 'break-all',
                  backgroundColor: '#f8fafc',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0'
                }}>
                  {selectedModel.externalURL}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Model Type</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {selectedModel.modelType} ({selectedModel.modelType === 'openai' ? 'OpenAI Compatible' : 'Traditional ML'})
                </div>
              </div>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Rate Limits</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {selectedModel.rateLimiting?.requestsPerMinute || 0}/min, {selectedModel.rateLimiting?.requestsPerHour || 0}/hr
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setActiveTab('test')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  color: activeTab === 'test' ? '#3b82f6' : '#6b7280',
                  borderBottom: activeTab === 'test' ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer'
                }}
              >
                <Play size={16} style={{ marginRight: '0.5rem' }} />
                Test Model
              </button>
              <button
                onClick={() => setActiveTab('code')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  color: activeTab === 'code' ? '#3b82f6' : '#6b7280',
                  borderBottom: activeTab === 'code' ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer'
                }}
              >
                <Code size={16} style={{ marginRight: '0.5rem' }} />
                Code Examples
              </button>
              <button
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  color: activeTab === 'history' ? '#3b82f6' : '#6b7280',
                  borderBottom: activeTab === 'history' ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer'
                }}
              >
                <Clock size={16} style={{ marginRight: '0.5rem' }} />
                Test History ({testHistory.length})
              </button>
            </div>
          </div>

          {/* Test Tab */}
          {activeTab === 'test' && (
            <div>
              {/* Request Presets */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Settings size={18} />
                  Request Presets
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  {requestPresets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => loadPreset(preset.name)}
                      className={`btn btn-sm ${selectedPreset === preset.name ? 'btn-primary' : 'btn-secondary'}`}
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Customization */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Settings size={18} />
                    Advanced Configuration
                  </h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={useCustomConfig}
                        onChange={(e) => setUseCustomConfig(e.target.checked)}
                      />
                      Use Custom Config
                    </label>
                    {useCustomConfig && (
                      <button
                        onClick={resetCustomization}
                        className="btn btn-secondary btn-sm"
                        title="Reset to defaults"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {useCustomConfig && (
                  <div style={{ 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '4px', 
                    padding: '1rem',
                    backgroundColor: '#f8fafc',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                          HTTP Method
                        </label>
                        <select
                          value={customMethod}
                          onChange={(e) => setCustomMethod(e.target.value)}
                          className="form-control"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                          Custom Endpoint
                        </label>
                        <input
                          type="text"
                          value={customEndpoint}
                          onChange={(e) => setCustomEndpoint(e.target.value)}
                          placeholder={selectedModel.externalURL}
                          className="form-control"
                        />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Custom Headers</label>
                        <button
                          onClick={addCustomHeader}
                          className="btn btn-secondary btn-sm"
                          title="Add header"
                        >
                          + Add Header
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {customHeaders.map((header, index) => (
                          <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                              placeholder="Header name"
                              className="form-control"
                              style={{ flex: 1 }}
                            />
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                              placeholder="Header value"
                              className="form-control"
                              style={{ flex: 1 }}
                            />
                            <button
                              onClick={() => removeCustomHeader(index)}
                              className="btn btn-secondary btn-sm"
                              title="Remove header"
                              disabled={customHeaders.length === 1}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Request Panel */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0 }}>Request</h4>
                    <button
                      onClick={() => generateSampleRequest(selectedModel)}
                      className="btn btn-secondary btn-sm"
                      title="Generate sample request"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                <textarea
                  value={testRequest}
                  onChange={(e) => setTestRequest(e.target.value)}
                  placeholder="Enter JSON request data..."
                  style={{
                    width: '100%',
                    height: '300px',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    padding: '1rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    backgroundColor: '#f8fafc'
                  }}
                />
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleTestModel}
                    disabled={testLoading || !testRequest.trim()}
                    className="btn btn-primary"
                  >
                    {testLoading ? 'Testing...' : 'Test Model'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(testRequest)}
                    className="btn btn-secondary"
                    disabled={!testRequest.trim()}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Response Panel */}
              <div>
                <h4 style={{ marginBottom: '1rem' }}>Response</h4>
                <div style={{
                  height: '300px',
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  backgroundColor: '#f8fafc',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}>
                  {testLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                      Testing model...
                    </div>
                  ) : testResponse ? (
                    <div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        marginBottom: '1rem',
                        padding: '0.5rem',
                        backgroundColor: testResponse.success ? '#dcfce7' : '#fef2f2',
                        borderRadius: '4px'
                      }}>
                        {testResponse.success ? (
                          <CheckCircle size={16} style={{ color: '#059669' }} />
                        ) : (
                          <AlertCircle size={16} style={{ color: '#dc2626' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: '500' }}>
                            {testResponse.success ? 'Success' : 'Error'} - {testResponse.status}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {testResponse.responseTime}ms
                          </div>
                        </div>
                      </div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(testResponse.success ? testResponse.data : testResponse.error, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div style={{ color: '#6b7280' }}>
                      Click "Test Model" to see the response
                    </div>
                  )}
                </div>
                {testResponse && (
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(testResponse.success ? testResponse.data : testResponse.error, null, 2))}
                      className="btn btn-secondary"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}

          {/* Code Examples Tab */}
          {activeTab === 'code' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Code Examples</h4>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <button
                    onClick={() => setActiveTab('curl')}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: activeTab === 'curl' ? '#e2e8f0' : 'transparent' }}
                  >
                    <Terminal size={14} style={{ marginRight: '0.5rem' }} />
                    cURL
                  </button>
                  <button
                    onClick={() => setActiveTab('python')}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: activeTab === 'python' ? '#e2e8f0' : 'transparent' }}
                  >
                    Python
                  </button>
                  <button
                    onClick={() => setActiveTab('javascript')}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: activeTab === 'javascript' ? '#e2e8f0' : 'transparent' }}
                  >
                    JavaScript
                  </button>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => copyToClipboard(
                    activeTab === 'curl' ? generateCurlCommand() :
                    activeTab === 'python' ? generatePythonCode() :
                    generateJavaScriptCode()
                  )}
                  className="btn btn-secondary btn-sm"
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    zIndex: 1
                  }}
                >
                  <Copy size={14} />
                </button>
                <pre style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '0.875rem',
                  margin: 0
                }}>
                  {activeTab === 'curl' && generateCurlCommand()}
                  {activeTab === 'python' && generatePythonCode()}
                  {activeTab === 'javascript' && generateJavaScriptCode()}
                </pre>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <h4 style={{ marginBottom: '1rem' }}>Test History</h4>
              {testHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No test history yet. Run some tests to see them here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {testHistory.map((test, index) => (
                    <div key={index} style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '1rem',
                      backgroundColor: test.success ? '#f0fdf4' : '#fef2f2'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {test.success ? (
                            <CheckCircle size={16} style={{ color: '#059669' }} />
                          ) : (
                            <AlertCircle size={16} style={{ color: '#dc2626' }} />
                          )}
                          <span style={{ fontWeight: '500' }}>
                            {test.success ? 'Success' : 'Error'} - {test.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {new Date(test.timestamp).toLocaleString()} ({test.responseTime}ms)
                        </div>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                        {test.endpoint}
                      </div>
                      <details>
                        <summary style={{ cursor: 'pointer', fontWeight: '500' }}>View Details</summary>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                          <strong>Request:</strong>
                          <pre style={{ fontSize: '0.75rem', margin: '0.5rem 0', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                            {JSON.stringify(test.request, null, 2)}
                          </pre>
                          <strong>Response:</strong>
                          <pre style={{ fontSize: '0.75rem', margin: '0.5rem 0', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                            {JSON.stringify(test.success ? test.data : test.error, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DeveloperConsole;