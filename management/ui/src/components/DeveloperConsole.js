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
  const api = useApi();
  const { user } = useAuth();

  useEffect(() => {
    fetchPublishedModels();
  }, []);

  const fetchPublishedModels = async () => {
    try {
      setLoading(true);
      const response = await api.getPublishedModels();
      const models = response.data.publishedModels || [];
      setPublishedModels(models);
      if (models.length > 0 && !selectedModel) {
        setSelectedModel(models[0]);
        generateSampleRequest(models[0]);
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
          instances: [
            { 
              feature1: 1.0, 
              feature2: 2.0, 
              feature3: 0.5,
              feature4: "sample_text"
            }
          ]
        };
    
    setTestRequest(JSON.stringify(sampleData, null, 2));
  };

  const handleModelChange = (modelName) => {
    const model = publishedModels.find(m => m.modelName === modelName);
    if (model) {
      setSelectedModel(model);
      generateSampleRequest(model);
      setTestResponse(null);
    }
  };

  const handleTestModel = async () => {
    if (!selectedModel || !testRequest.trim()) {
      toast.error('Please select a model and provide test data');
      return;
    }

    setTestLoading(true);
    const startTime = Date.now();

    try {
      const requestData = JSON.parse(testRequest);
      
      const endpoint = selectedModel.modelType === 'openai' 
        ? `${selectedModel.externalURL}/chat/completions`
        : `${selectedModel.externalURL}/predict`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': selectedModel.apiKey
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const testResult = {
        success: response.ok,
        data: result,
        request: requestData,
        endpoint: endpoint,
        status: response.status,
        statusText: response.statusText,
        responseTime: responseTime,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString()
      };

      setTestResponse(testResult);
      
      // Add to history
      setTestHistory(prev => [testResult, ...prev.slice(0, 9)]); // Keep last 10 tests
      
      if (response.ok) {
        toast.success(`Test completed successfully (${responseTime}ms)`);
      } else {
        toast.error(`Test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        request: testRequest,
        endpoint: selectedModel.modelType === 'openai' 
          ? `${selectedModel.externalURL}/chat/completions`
          : `${selectedModel.externalURL}/predict`,
        status: 'Network Error',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      setTestResponse(errorResult);
      setTestHistory(prev => [errorResult, ...prev.slice(0, 9)]);
      toast.error(`Network error: ${error.message}`);
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

    const endpoint = selectedModel.modelType === 'openai' 
      ? `${selectedModel.externalURL}/chat/completions`
      : `${selectedModel.externalURL}/predict`;

    return `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${selectedModel.apiKey}" \\
  -d '${testRequest.replace(/'/g, "\\'")}'`;
  };

  const generatePythonCode = () => {
    if (!selectedModel || !testRequest.trim()) return '';

    const endpoint = selectedModel.modelType === 'openai' 
      ? `${selectedModel.externalURL}/chat/completions`
      : `${selectedModel.externalURL}/predict`;

    return `import requests
import json

# Model endpoint
url = "${endpoint}"

# Headers
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "${selectedModel.apiKey}"
}

# Request data
data = ${testRequest}

# Make request
response = requests.post(url, headers=headers, json=data)

# Check response
if response.status_code == 200:
    result = response.json()
    print("Success:", result)
else:
    print("Error:", response.status_code, response.text)`;
  };

  const generateJavaScriptCode = () => {
    if (!selectedModel || !testRequest.trim()) return '';

    const endpoint = selectedModel.modelType === 'openai' 
      ? `${selectedModel.externalURL}/chat/completions`
      : `${selectedModel.externalURL}/predict`;

    return `// Model endpoint
const url = "${endpoint}";

// Headers
const headers = {
    "Content-Type": "application/json",
    "X-API-Key": "${selectedModel.apiKey}"
};

// Request data
const data = ${testRequest};

// Make request
fetch(url, {
    method: 'POST',
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
          Test your published models with real external API calls
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