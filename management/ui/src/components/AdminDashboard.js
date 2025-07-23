import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ModelList from './ModelList';
import ModelForm from './ModelForm';
import InferenceTest from './InferenceTest';
import AdminSystem from './AdminSystem';
import AdminLogs from './AdminLogs';
import AdminResources from './AdminResources';
import AdminKubectl from './AdminKubectl';
import PublishingDashboard from './PublishingDashboard';
import DeveloperConsole from './DeveloperConsole';
import ModelsUsage from './ModelsUsage';
import { LogOut, Shield, Database, Activity, Terminal, FileText, Settings, Users, Globe, Code, BarChart3 } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('models');
  const { logout } = useAuth();

  // MLOps Concerns: Model lifecycle, deployment, and day-2 operations
  const mlopsTabs = [
    { id: 'create', label: 'Deploy Models', icon: Settings, component: ModelForm, description: 'Deploy new models to any tenant namespace' },
    { id: 'models', label: 'Model Management', icon: Database, component: ModelList, description: 'View, manage, and monitor AI/ML models across all tenants' },
    { id: 'inference', label: 'Test Model Inference', icon: Activity, component: InferenceTest, description: 'Test model APIs and validate inference endpoints' },
    { id: 'publishing', label: 'Model Publishing', icon: Globe, component: PublishingDashboard, description: 'Publish models to external API endpoints with authentication' },
    { id: 'usage', label: 'Models Usage', icon: BarChart3, component: ModelsUsage, description: 'Monitor model performance, usage analytics, and cost tracking across deployments' },
  ];

  // Developer Concerns: API access, usage monitoring, and application debugging
  const developerTabs = [
    { id: 'developer', label: 'Developer Console', icon: Code, component: DeveloperConsole, description: 'Test published models with external API calls and view code examples' },
    { id: 'logs', label: 'Model Service Logs', icon: FileText, component: AdminLogs, description: 'View inference logs and debugging information for model services and deployments' },
  ];

  // Platform Operator Concerns: Infrastructure, resources, and system administration
  const platformTabs = [
    { id: 'resources', label: 'Platform Navigator', icon: Users, component: AdminResources, description: 'Navigate and explore AI/ML inference platform resources including Istio and KServe components' },
    { id: 'kubectl', label: 'Platform Console', icon: Terminal, component: AdminKubectl, description: 'Execute kubectl commands and platform operations' },
  ];

  const allTabs = [...mlopsTabs, ...developerTabs, ...platformTabs];
  const ActiveComponent = allTabs.find(tab => tab.id === activeTab)?.component;
  const activeTabInfo = allTabs.find(tab => tab.id === activeTab);

  return (
    <>
      {/* Header with admin indicator */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: 'rgba(255, 203, 92, 0.1)',
        borderRadius: '8px',
        border: '1px solid #FFCB5C'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} color="#FFCB5C" />
          <span style={{ fontWeight: '600', color: '#CC9B2E' }}>Super Admin Dashboard</span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={logout}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* Feature Guide */}
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1rem', 
        backgroundColor: '#f8fafc', 
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          AI Model Management Platform
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          As a super admin, you have access to all platform features organized by role and concern area.
        </p>
        
        {/* MLOps Concerns */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#6DC28B' }}>
            🤖 MLOps Concerns
          </h4>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            Model lifecycle management, deployment, testing, and day-2 operations
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
            {mlopsTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <div 
                  key={tab.id}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: activeTab === tab.id ? 'rgba(109, 194, 139, 0.1)' : '#fff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: activeTab === tab.id ? '1px solid #6DC28B' : '1px solid #e5e7eb',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} color={activeTab === tab.id ? '#6DC28B' : '#6b7280'} />
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{tab.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{tab.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Developer Concerns */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#5721F0' }}>
            💻 Developer Concerns
          </h4>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            API testing, application debugging, and developer-focused tools
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
            {developerTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <div 
                  key={tab.id}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: activeTab === tab.id ? 'rgba(87, 33, 240, 0.1)' : '#fff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: activeTab === tab.id ? '1px solid #5721F0' : '1px solid #e5e7eb',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} color={activeTab === tab.id ? '#5721F0' : '#6b7280'} />
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{tab.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{tab.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform Operator Concerns */}
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#F36863' }}>
            ⚙️ Platform Operator Concerns
          </h4>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            Infrastructure management, system administration, and cluster operations
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
            {platformTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <div 
                  key={tab.id}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: activeTab === tab.id ? 'rgba(243, 104, 99, 0.1)' : '#fff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: activeTab === tab.id ? '1px solid #F36863' : '1px solid #e5e7eb',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} color={activeTab === tab.id ? '#F36863' : '#6b7280'} />
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{tab.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{tab.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active tab info */}
      {activeTabInfo && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(28, 118, 253, 0.1)', borderRadius: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <activeTabInfo.icon size={18} color="#1C76FD" />
            <span style={{ fontWeight: '600', color: '#1C76FD' }}>{activeTabInfo.label}</span>
          </div>
          <p style={{ color: '#0A4FCF', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            {activeTabInfo.description}
          </p>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="nav-tabs" style={{ marginBottom: '2rem' }}>
        {allTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Active Component */}
      {ActiveComponent && <ActiveComponent />}
    </>
  );
};

export default AdminDashboard;