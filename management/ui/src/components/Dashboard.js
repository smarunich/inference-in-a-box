import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ModelList from './ModelList';
import ModelForm from './ModelForm';
import InferenceTest from './InferenceTest';
import AdminDashboard from './AdminDashboard';
import PublishingDashboard from './PublishingDashboard';
import DeveloperConsole from './DeveloperConsole';
import { LogOut } from 'lucide-react';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('models');
  const { logout, user } = useAuth();

  // Debug logging
  console.log('Dashboard - user:', user);
  console.log('Dashboard - user.isAdmin:', user?.isAdmin);

  // If user is admin, show admin dashboard
  if (user?.isAdmin) {
    console.log('Rendering AdminDashboard for admin user');
    return <AdminDashboard />;
  }

  // MLOps Concerns: Model lifecycle and day-2 operations (limited to user's tenant)
  const mlopsTabs = [
    { id: 'models', label: 'Model Management', component: ModelList, description: 'View and manage your AI/ML models' },
    { id: 'create', label: 'Deploy Models', component: ModelForm, description: 'Deploy new models to your tenant' },
    { id: 'inference', label: 'Test Inference', component: InferenceTest, description: 'Test model predictions' },
    { id: 'publishing', label: 'Model Publishing', component: PublishingDashboard, description: 'Publish models to external APIs' },
    { id: 'developer', label: 'Developer Console', component: DeveloperConsole, description: 'Test published models with external API calls' },
  ];

  const tabs = mlopsTabs;

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>AI Model Management</span>
          <span style={{ fontSize: '0.875rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            {user?.tenant || 'Tenant'}
          </span>
        </div>
        
        <button
          className="btn btn-secondary btn-sm"
          onClick={logout}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* MLOps Dashboard */}
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1rem', 
        backgroundColor: '#f8fafc', 
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#059669' }}>
          🤖 MLOps Dashboard
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          Manage your AI/ML models, deployments, and inference endpoints within your tenant.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {tabs.map(tab => (
            <div 
              key={tab.id}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                padding: '1rem',
                backgroundColor: activeTab === tab.id ? '#d1fae5' : '#fff',
                borderRadius: '6px',
                cursor: 'pointer',
                border: activeTab === tab.id ? '1px solid #059669' : '1px solid #e5e7eb',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <div>
                <div style={{ fontWeight: '500', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{tab.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{tab.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tab-content">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </>
  );
};

export default Dashboard;