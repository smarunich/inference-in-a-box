import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import ReactJsonView from 'react-json-view';
import { Play, Copy } from 'lucide-react';

const InferenceTest = () => {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [inputData, setInputData] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const api = useApi();

  useEffect(() => {
    fetchModels();
  }, []);

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

      const result = await api.predict(selectedModel, parsedInput);
      setResponse(result.data);
      toast.success('Prediction completed successfully');
    } catch (error) {
      if (error.name === 'SyntaxError') {
        toast.error('Invalid JSON input');
      } else {
        const errorMessage = error.response?.data?.error || 'Prediction failed';
        toast.error(errorMessage);
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
              </div>
            </div>
          </div>

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
                <ReactJsonView
                  src={response}
                  theme="rjv-default"
                  collapsed={false}
                  displayDataTypes={false}
                  displayObjectSize={false}
                  enableClipboard={false}
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
              <p><strong>Sklearn/XGBoost:</strong> <code>{"instances": [[1, 2, 3, 4]]}</code></p>
              <p><strong>TensorFlow:</strong> <code>{"instances": [{"input": [1, 2, 3, 4]}]}</code></p>
              <p><strong>PyTorch:</strong> <code>{"instances": [{"data": [1, 2, 3, 4]}]}</code></p>
              <p><strong>Images:</strong> <code>{"instances": [{"b64": "base64-encoded-image"}]}</code></p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InferenceTest;