import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ModelList from './ModelList';
import ModelForm from './ModelForm';
import InferenceTest from './InferenceTest';
import AdminSystem from './AdminSystem';
import AdminLogs from './AdminLogs';
import AdminResources from './AdminResources';
import AdminKubectl from './AdminKubectl';
import { LogOut, Shield, Database, Activity, Terminal, FileText, Settings, Users } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('models');
  const { logout } = useAuth();

  const tabs = [
    { id: 'models', label: 'Models', icon: Database, component: ModelList, description: 'Manage AI/ML models across all tenants' },
    { id: 'create', label: 'Create Model', icon: Settings, component: ModelForm, description: 'Deploy new models to any tenant' },
    { id: 'inference', label: 'Test Inference', icon: Activity, component: InferenceTest, description: 'Test model predictions' },
    { id: 'system', label: 'System Overview', icon: Shield, component: AdminSystem, description: 'Monitor cluster health and status' },
    { id: 'resources', label: 'Resources', icon: Users, component: AdminResources, description: 'View pods, services, and deployments' },
    { id: 'logs', label: 'Logs', icon: FileText, component: AdminLogs, description: 'Access system and application logs' },
    { id: 'kubectl', label: 'kubectl', icon: Terminal, component: AdminKubectl, description: 'Execute kubectl commands' },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;
  const activeTabInfo = tabs.find(tab => tab.id === activeTab);

  return (
    <>
      {/* Header with admin indicator */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        border: '1px solid #f59e0b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} color="#f59e0b" />
          <span style={{ fontWeight: '600', color: '#92400e' }}>Super Admin Dashboard</span>
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
          Welcome to AI Model Management Platform
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          As a super admin, you have access to all platform features and can manage resources across all tenants.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <div 
                key={tab.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: activeTab === tab.id ? '#dbeafe' : 'transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: activeTab === tab.id ? '1px solid #3b82f6' : '1px solid transparent'
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} color={activeTab === tab.id ? '#3b82f6' : '#6b7280'} />
                <div>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{tab.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{tab.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active tab info */}
      {activeTabInfo && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <activeTabInfo.icon size={18} color="#0369a1" />
            <span style={{ fontWeight: '600', color: '#0369a1' }}>{activeTabInfo.label}</span>
          </div>
          <p style={{ color: '#075985', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            {activeTabInfo.description}
          </p>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="nav-tabs" style={{ marginBottom: '2rem' }}>
        {tabs.map(tab => {
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