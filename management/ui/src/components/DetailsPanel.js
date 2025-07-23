import React, { useState } from 'react';
import {
  X,
  Copy,
  ExternalLink,
  Edit3,
  Trash2,
  Eye,
  Info,
  Shield,
  Network,
  Server,
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Tag,
  Globe,
  Settings,
  Cpu,
  Activity
} from 'lucide-react';
import JsonView from '@uiw/react-json-view';

const DetailsPanel = ({ selectedResource, onClose, onResourceAction }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState(new Set(['metadata', 'spec']));

  if (!selectedResource) {
    return null;
  }

  const getResourceIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'gateway':
        return <Network size={20} />;
      case 'gatewayclass':
        return <Globe size={20} />;
      case 'httproute':
      case 'aigatewayroute':
        return <Settings size={20} />;
      case 'service':
        return <Database size={20} />;
      case 'pod':
        return <Server size={20} />;
      case 'inferenceservice':
        return <Cpu size={20} />;
      case 'securitypolicy':
      case 'backendsecuritypolicy':
      case 'authorizationpolicy':
      case 'peerauthentication':
        return <Shield size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return { color: '#059669', bg: '#d1fae5', border: '#059669' };
      case 'warning':
        return { color: '#d97706', bg: '#fef3c7', border: '#d97706' };
      case 'error':
        return { color: '#dc2626', bg: '#fee2e2', border: '#dc2626' };
      default:
        return { color: '#6b7280', bg: '#f3f4f6', border: '#6b7280' };
    }
  };

  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log('Copied to clipboard');
    });
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const statusColors = getStatusColor(selectedResource.status);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'spec', label: 'Specification', icon: Settings },
    { id: 'status', label: 'Status', icon: Activity },
    { id: 'events', label: 'Events', icon: Clock }
  ];

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '400px',
      height: '100%',
      backgroundColor: 'white',
      borderLeft: '1px solid #e5e7eb',
      boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {getResourceIcon(selectedResource.type)}
            <h2 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px'
            }}>
              {selectedResource.name}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            fontWeight: '500'
          }}>
            {selectedResource.type}
          </span>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            backgroundColor: statusColors.bg,
            color: statusColors.color,
            borderRadius: '4px',
            fontWeight: '500',
            border: `1px solid ${statusColors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            {selectedResource.status === 'healthy' && <CheckCircle size={12} />}
            {selectedResource.status === 'warning' && <AlertCircle size={12} />}
            {selectedResource.status === 'error' && <XCircle size={12} />}
            {selectedResource.status || 'Unknown'}
          </span>
        </div>

        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          <div style={{ marginBottom: '0.25rem' }}>
            <strong>Namespace:</strong> {selectedResource.namespace || 'default'}
          </div>
          {selectedResource.metadata?.uid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong>UID:</strong> 
              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {selectedResource.metadata.uid.substring(0, 8)}...
              </span>
              <button
                onClick={() => copyToClipboard(selectedResource.metadata.uid)}
                style={{ padding: '2px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
              >
                <Copy size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onResourceAction && onResourceAction('view', selectedResource.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Eye size={14} />
            View
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onResourceAction && onResourceAction('edit', selectedResource.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Edit3 size={14} />
            Edit
          </button>
          <button
            onClick={() => copyToClipboard(JSON.stringify(selectedResource.metadata, null, 2))}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '0.75rem 0.5rem',
                border: 'none',
                backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280'
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {activeTab === 'overview' && (
          <OverviewTab resource={selectedResource} />
        )}

        {activeTab === 'spec' && (
          <SpecificationTab 
            resource={selectedResource} 
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          />
        )}

        {activeTab === 'status' && (
          <StatusTab resource={selectedResource} />
        )}

        {activeTab === 'events' && (
          <EventsTab resource={selectedResource} />
        )}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ resource }) => {
  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Basic Information */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>Basic Information</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <InfoRow label="Name" value={resource.name} />
          <InfoRow label="Type" value={resource.type} />
          <InfoRow label="Namespace" value={resource.namespace || 'default'} />
          <InfoRow label="Status" value={resource.status || 'Unknown'} />
        </div>
      </div>

      {/* Metadata */}
      {resource.metadata && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>Metadata</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {resource.metadata.creationTimestamp && (
              <InfoRow 
                label="Created" 
                value={new Date(resource.metadata.creationTimestamp).toLocaleString()} 
              />
            )}
            {resource.metadata.uid && (
              <InfoRow label="UID" value={resource.metadata.uid} mono />
            )}
            {resource.metadata.resourceVersion && (
              <InfoRow label="Version" value={resource.metadata.resourceVersion} />
            )}
            {resource.metadata.generation && (
              <InfoRow label="Generation" value={resource.metadata.generation} />
            )}
          </div>
        </div>
      )}

      {/* Labels */}
      {resource.metadata?.labels && Object.keys(resource.metadata.labels).length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>Labels</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {Object.entries(resource.metadata.labels).map(([key, value]) => (
              <span 
                key={key}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db'
                }}
              >
                <Tag size={10} style={{ display: 'inline', marginRight: '0.25rem' }} />
                {key}={value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Connections */}
      {resource.connections && resource.connections.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>Connections</h3>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {resource.connections.length} connected resource{resource.connections.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

// Specification Tab Component
const SpecificationTab = ({ resource, expandedSections, toggleSection }) => {
  if (!resource.metadata) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
        No specification data available
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <JsonView 
        value={resource.metadata}
        style={{
          backgroundColor: '#f9fafb',
          fontSize: '0.75rem'
        }}
        collapsed={2}
        displayObjectSize={false}
        displayDataTypes={false}
        enableClipboard={true}
      />
    </div>
  );
};

// Status Tab Component
const StatusTab = ({ resource }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>Resource Status</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <InfoRow label="Current Status" value={resource.status || 'Unknown'} />
          
          {/* Pod-specific status */}
          {resource.type === 'Pod' && resource.metadata && (
            <>
              <InfoRow label="Phase" value={resource.metadata.phase || 'Unknown'} />
              <InfoRow label="Ready" value={resource.metadata.ready ? 'Yes' : 'No'} />
              {resource.metadata.restartCount !== undefined && (
                <InfoRow label="Restart Count" value={resource.metadata.restartCount} />
              )}
            </>
          )}

          {/* Service-specific status */}
          {resource.type === 'Service' && resource.metadata && (
            <>
              <InfoRow label="Cluster IP" value={resource.metadata.clusterIP || 'N/A'} />
              <InfoRow label="Type" value={resource.metadata.type || 'N/A'} />
              {resource.metadata.ports && (
                <InfoRow 
                  label="Ports" 
                  value={resource.metadata.ports.map(p => `${p.port}/${p.protocol}`).join(', ')} 
                />
              )}
            </>
          )}

          {/* InferenceService-specific status */}
          {resource.type === 'InferenceService' && resource.metadata && (
            <>
              <InfoRow label="Ready" value={resource.metadata.ready ? 'Yes' : 'No'} />
              {resource.metadata.url && (
                <InfoRow label="URL" value={resource.metadata.url} />
              )}
            </>
          )}
        </div>
      </div>

      {resource.metadata?.conditions && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>Conditions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {resource.metadata.conditions.map((condition, index) => (
              <div 
                key={index}
                style={{
                  padding: '0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  backgroundColor: condition.status === 'True' ? '#f0fdf4' : '#fef2f2'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  {condition.status === 'True' ? (
                    <CheckCircle size={16} color="#059669" />
                  ) : (
                    <XCircle size={16} color="#dc2626" />
                  )}
                  <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                    {condition.type}
                  </span>
                </div>
                {condition.message && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {condition.message}
                  </div>
                )}
                {condition.lastTransitionTime && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Last updated: {new Date(condition.lastTransitionTime).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Events Tab Component
const EventsTab = ({ resource }) => {
  return (
    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
      <Clock size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
      <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem' }}>Events</h3>
      <p style={{ fontSize: '0.875rem', margin: 0 }}>
        Event tracking is not yet implemented for this resource type
      </p>
    </div>
  );
};

// Helper component for info rows
const InfoRow = ({ label, value, mono = false }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
    <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500', minWidth: '80px' }}>
      {label}:
    </span>
    <span style={{ 
      fontSize: '0.875rem', 
      fontFamily: mono ? 'monospace' : 'inherit',
      wordBreak: 'break-all',
      textAlign: 'right',
      flex: 1
    }}>
      {value}
    </span>
  </div>
);

export default DetailsPanel;