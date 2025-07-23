import React from 'react';
import { AlertTriangle, RefreshCw, Bug, ChevronDown, ChevronRight } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and update state with error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // You can also log the error to an error reporting service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false
    });
    
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          margin: '1rem'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={48} color="#dc2626" style={{ marginBottom: '1rem' }} />
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: '#dc2626', 
              marginBottom: '0.5rem' 
            }}>
              {this.props.title || 'Something went wrong'}
            </h2>
            <p style={{ 
              color: '#b91c1c', 
              fontSize: '0.875rem',
              marginBottom: '1rem' 
            }}>
              {this.props.message || 'An unexpected error occurred while rendering this component.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <RefreshCw size={16} />
              Try Again
            </button>

            {(this.state.error || this.state.errorInfo) && (
              <button
                onClick={this.toggleDetails}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  color: '#dc2626',
                  border: '1px solid #dc2626',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Bug size={16} />
                {this.state.showDetails ? 'Hide Details' : 'Show Details'}
                {this.state.showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
          </div>

          {/* Error Details */}
          {this.state.showDetails && (this.state.error || this.state.errorInfo) && (
            <div style={{
              textAlign: 'left',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '1rem',
              marginTop: '1rem'
            }}>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                marginBottom: '0.75rem',
                color: '#374151'
              }}>
                Error Details
              </h3>
              
              {this.state.error && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    marginBottom: '0.5rem',
                    color: '#6b7280'
                  }}>
                    Error Message:
                  </h4>
                  <pre style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    backgroundColor: '#f9fafb',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    color: '#dc2626',
                    margin: 0
                  }}>
                    {this.state.error.toString()}
                  </pre>
                </div>
              )}

              {this.state.errorInfo && this.state.errorInfo.componentStack && (
                <div>
                  <h4 style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    marginBottom: '0.5rem',
                    color: '#6b7280'
                  }}>
                    Component Stack:
                  </h4>
                  <pre style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    backgroundColor: '#f9fafb',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    color: '#374151',
                    margin: 0,
                    maxHeight: '200px'
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div style={{ 
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: '#fef3c7',
                borderRadius: '4px',
                border: '1px solid #f59e0b'
              }}>
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: '#92400e',
                  margin: 0
                }}>
                  <strong>Note:</strong> This error information is shown to help with debugging. 
                  In production, this would typically be logged to an error monitoring service.
                </p>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            border: '1px solid #0ea5e9'
          }}>
            <p style={{ 
              fontSize: '0.75rem', 
              color: '#0c4a6e',
              margin: 0
            }}>
              If this error persists, try refreshing the page or check the browser console for more details.
            </p>
          </div>
        </div>
      );
    }

    // If no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;