import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Zap,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  Database,
  Target,
  DollarSign,
  RefreshCw,
  Calendar,
  Filter,
  Download,
  Eye
} from 'lucide-react';

const ModelsUsage = () => {
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedModel, setSelectedModel] = useState('all');
  const api = useApi();

  useEffect(() => {
    fetchUsageData();
  }, [timeRange, selectedModel]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      // Simulate API call for usage data - replace with actual API endpoint
      const mockData = {
        summary: {
          totalRequests: 15420,
          successRate: 98.2,
          avgLatency: 145,
          activeModels: 8,
          totalTokens: 2840000,
          estimatedCost: 284.50
        },
        models: [
          {
            name: 'llama-3-8b',
            namespace: 'tenant-a',
            requests: 8540,
            successRate: 99.1,
            avgLatency: 120,
            tokens: 1680000,
            cost: 168.00,
            lastUsed: '2 minutes ago',
            status: 'active'
          },
          {
            name: 'gpt-3.5-turbo',
            namespace: 'tenant-b',
            requests: 4230,
            successRate: 97.8,
            avgLatency: 180,
            tokens: 850000,
            cost: 85.00,
            lastUsed: '5 minutes ago',
            status: 'active'
          },
          {
            name: 'claude-instant',
            namespace: 'tenant-a',
            requests: 2650,
            successRate: 98.5,
            avgLatency: 160,
            tokens: 310000,
            cost: 31.50,
            lastUsed: '1 hour ago',
            status: 'idle'
          }
        ],
        trends: {
          hourlyRequests: [120, 135, 180, 220, 195, 240, 280, 310, 340, 380, 420, 450],
          hourlyLatency: [140, 145, 150, 148, 152, 160, 155, 150, 145, 142, 138, 145],
          hourlyErrors: [2, 1, 3, 2, 4, 2, 1, 2, 3, 1, 2, 1]
        },
        alerts: [
          {
            type: 'warning',
            message: 'High latency detected on gpt-3.5-turbo model',
            timestamp: '10 minutes ago',
            severity: 'medium'
          },
          {
            type: 'info',
            message: 'Token usage approaching 80% of daily limit for tenant-a',
            timestamp: '1 hour ago',
            severity: 'low'
          }
        ]
      };
      
      setUsageData(mockData);
    } catch (error) {
      toast.error('Failed to fetch usage data');
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return { bg: '#dcfce7', text: '#166534', border: '#22c55e' };
      case 'idle': return { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' };
      case 'error': return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' };
      default: return { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' };
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={16} color="#f59e0b" />;
      case 'error': return <AlertTriangle size={16} color="#ef4444" />;
      case 'info': return <CheckCircle size={16} color="#3b82f6" />;
      default: return <Activity size={16} color="#6b7280" />;
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading" style={{ textAlign: 'center', padding: '3rem' }}>
          <BarChart3 size={48} color="#6b7280" style={{ marginBottom: '1rem' }} />
          <p>Loading usage analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div>
          <h2 style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            fontSize: '1.5rem', 
            fontWeight: '600',
            margin: 0
          }}>
            <BarChart3 size={24} />
            Models Usage & Analytics
          </h2>
          <p style={{ color: '#6b7280', marginTop: '0.5rem', margin: 0 }}>
            Monitor model performance, usage patterns, and cost analytics across all deployments
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Time Range Filter */}
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem'
            }}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          {/* Model Filter */}
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Models</option>
            {usageData?.models.map(model => (
              <option key={model.name} value={model.name}>{model.name}</option>
            ))}
          </select>

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={fetchUsageData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <UsageCard
          title="Total Requests"
          value={formatNumber(usageData?.summary.totalRequests)}
          subtitle={`Last ${timeRange}`}
          icon={<Activity size={20} />}
          color="blue"
        />
        <UsageCard
          title="Success Rate"
          value={`${usageData?.summary.successRate}%`}
          subtitle="Overall reliability"
          icon={<CheckCircle size={20} />}
          color="green"
        />
        <UsageCard
          title="Avg Latency"
          value={`${usageData?.summary.avgLatency}ms`}
          subtitle="Response time"
          icon={<Zap size={20} />}
          color="yellow"
        />
        <UsageCard
          title="Active Models"
          value={usageData?.summary.activeModels}
          subtitle="Currently serving"
          icon={<Database size={20} />}
          color="purple"
        />
        <UsageCard
          title="Total Tokens"
          value={formatNumber(usageData?.summary.totalTokens)}
          subtitle="Processed tokens"
          icon={<Target size={20} />}
          color="indigo"
        />
        <UsageCard
          title="Estimated Cost"
          value={`$${usageData?.summary.estimatedCost}`}
          subtitle={`Last ${timeRange}`}
          icon={<DollarSign size={20} />}
          color="green"
        />
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Model Performance Table */}
        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px',
          backgroundColor: '#ffffff'
        }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Database size={20} />
            Model Performance
          </h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: '500' }}>Model</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', fontWeight: '500' }}>Requests</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', fontWeight: '500' }}>Success</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', fontWeight: '500' }}>Latency</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: '500' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {usageData?.models.map((model, index) => {
                  const statusColors = getStatusColor(model.status);
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: '500' }}>{model.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{model.namespace}</div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>
                        {formatNumber(model.requests)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>
                        <span style={{ color: model.successRate >= 98 ? '#059669' : '#f59e0b' }}>
                          {model.successRate}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>
                        {model.avgLatency}ms
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: statusColors.bg,
                          color: statusColors.text,
                          border: `1px solid ${statusColors.border}`,
                          textTransform: 'capitalize'
                        }}>
                          {model.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Usage Trends */}
        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px',
          backgroundColor: '#ffffff'
        }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <TrendingUp size={20} />
            Usage Trends
          </h3>
          
          {/* Simple trend visualization */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Requests per Hour
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'end', 
              gap: '2px', 
              height: '60px',
              padding: '0.5rem',
              backgroundColor: '#f9fafb',
              borderRadius: '4px'
            }}>
              {usageData?.trends.hourlyRequests.map((value, index) => (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    height: `${(value / Math.max(...usageData.trends.hourlyRequests)) * 100}%`,
                    backgroundColor: '#3b82f6',
                    borderRadius: '2px',
                    minHeight: '4px'
                  }}
                  title={`Hour ${index + 1}: ${value} requests`}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Average Latency (ms)
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'end', 
              gap: '2px', 
              height: '60px',
              padding: '0.5rem',
              backgroundColor: '#f9fafb',
              borderRadius: '4px'
            }}>
              {usageData?.trends.hourlyLatency.map((value, index) => (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    height: `${(value / Math.max(...usageData.trends.hourlyLatency)) * 100}%`,
                    backgroundColor: '#f59e0b',
                    borderRadius: '2px',
                    minHeight: '4px'
                  }}
                  title={`Hour ${index + 1}: ${value}ms`}
                />
              ))}
            </div>
          </div>

          {/* Export Button */}
          <button 
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}
          >
            <Download size={16} />
            Export Analytics Report
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {usageData?.alerts && usageData.alerts.length > 0 && (
        <div style={{ 
          marginTop: '2rem',
          padding: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px',
          backgroundColor: '#ffffff'
        }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertTriangle size={20} />
            Recent Alerts
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {usageData.alerts.map((alert, index) => (
              <div 
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  backgroundColor: '#f9fafb'
                }}
              >
                {getAlertIcon(alert.type)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    {alert.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {alert.timestamp}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: alert.severity === 'high' ? '#fee2e2' : 
                                  alert.severity === 'medium' ? '#fef3c7' : '#dbeafe',
                  color: alert.severity === 'high' ? '#991b1b' : 
                         alert.severity === 'medium' ? '#92400e' : '#1e40af',
                  textTransform: 'capitalize'
                }}>
                  {alert.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Usage Card Component
const UsageCard = ({ title, value, subtitle, icon, color }) => {
  const colorClasses = {
    blue: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    green: { bg: '#dcfce7', border: '#22c55e', text: '#16a34a' },
    yellow: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    purple: { bg: '#e9d5ff', border: '#a855f7', text: '#7c3aed' },
    indigo: { bg: '#e0e7ff', border: '#6366f1', text: '#4f46e5' },
    red: { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' }
  };
  
  const colors = colorClasses[color] || colorClasses.blue;
  
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '1rem', 
      backgroundColor: colors.bg, 
      borderRadius: '8px', 
      border: `1px solid ${colors.border}` 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ color: colors.text }}>{icon}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: colors.text }}>{title}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: '600', color: colors.text, marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: colors.text }}>
        {subtitle}
      </div>
    </div>
  );
};

export default ModelsUsage;