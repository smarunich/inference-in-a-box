import React, { useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import { Terminal, Play, Copy, Clock, AlertTriangle } from 'lucide-react';

const AdminKubectl = () => {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const api = useApi();

  const executeCommand = async () => {
    if (!command.trim()) {
      toast.error('Please enter a command');
      return;
    }

    try {
      setLoading(true);
      setOutput('');
      
      const response = await api.executeKubectl(command);
      setOutput(response.data.result);
      
      // Add to history
      const historyEntry = {
        command: response.data.command,
        output: response.data.result,
        timestamp: new Date().toISOString(),
        success: true
      };
      setCommandHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10 commands
      
      toast.success('Command executed successfully');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Command execution failed';
      setOutput(`Error: ${errorMessage}`);
      
      // Add error to history
      const historyEntry = {
        command: `kubectl ${command}`,
        output: errorMessage,
        timestamp: new Date().toISOString(),
        success: false
      };
      setCommandHistory(prev => [historyEntry, ...prev.slice(0, 9)]);
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      executeCommand();
    }
  };

  const commonCommands = [
    { label: 'Get All Pods', command: 'get pods -A' },
    { label: 'Get Services', command: 'get services -A' },
    { label: 'Get Deployments', command: 'get deployments -A' },
    { label: 'Get Nodes', command: 'get nodes' },
    { label: 'Get Namespaces', command: 'get namespaces' },
    { label: 'Get InferenceServices', command: 'get inferenceservices -A' },
    { label: 'Describe Node', command: 'describe nodes' },
    { label: 'Get Events', command: 'get events -A --sort-by=.metadata.creationTimestamp' },
    { label: 'Top Nodes', command: 'top nodes' },
    { label: 'Top Pods', command: 'top pods -A' },
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <Terminal size={24} color="#3b82f6" />
        <h2>kubectl Interface</h2>
      </div>

      {/* Security Warning */}
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#fef3c7', 
        borderRadius: '6px', 
        marginBottom: '2rem',
        border: '1px solid #f59e0b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <AlertTriangle size={18} color="#f59e0b" />
          <span style={{ fontWeight: '600', color: '#92400e' }}>Security Notice</span>
        </div>
        <p style={{ color: '#92400e', fontSize: '0.875rem' }}>
          Only safe read operations are allowed (get, describe, logs, top). 
          Write operations are restricted for security.
        </p>
      </div>

      {/* Command Input */}
      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <label className="form-label">kubectl Command</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0.5rem 0.75rem',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px 0 0 6px',
            border: '1px solid #d1d5db',
            borderRight: 'none',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151'
          }}>
            kubectl
          </div>
          <input
            type="text"
            className="form-input"
            style={{ borderRadius: '0 6px 6px 0' }}
            placeholder="get pods -A"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            className="btn btn-primary"
            onClick={executeCommand}
            disabled={loading || !command.trim()}
          >
            <Play size={16} />
            {loading ? 'Running...' : 'Execute'}
          </button>
        </div>
        <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Press Ctrl+Enter (or Cmd+Enter on Mac) to execute
        </small>
      </div>

      {/* Common Commands */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Common Commands</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.5rem' }}>
          {commonCommands.map((cmd, index) => (
            <button
              key={index}
              className="btn btn-secondary btn-sm"
              onClick={() => setCommand(cmd.command)}
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Output */}
      {(output || loading) && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Output</h3>
            {output && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(output)}
              >
                <Copy size={16} />
                Copy
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="loading">Executing command...</div>
          ) : (
            <div 
              className="code-block" 
              style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                backgroundColor: '#1f2937',
                color: '#f9fafb',
                padding: '1rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                whiteSpace: 'pre-wrap'
              }}
            >
              {output}
            </div>
          )}
        </div>
      )}

      {/* Command History */}
      {commandHistory.length > 0 && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} />
            Command History
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {commandHistory.map((entry, index) => (
              <div 
                key={index}
                style={{ 
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: `1px solid ${entry.success ? '#d1fae5' : '#fee2e2'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <code style={{ 
                    backgroundColor: '#f3f4f6', 
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem'
                  }}>
                    {entry.command}
                  </code>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(entry.output)}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                
                <div 
                  style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto',
                    backgroundColor: entry.success ? '#f0fdf4' : '#fef2f2',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    color: entry.success ? '#166534' : '#dc2626'
                  }}
                >
                  {entry.output}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminKubectl;