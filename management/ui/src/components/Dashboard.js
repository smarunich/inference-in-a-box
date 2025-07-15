import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ModelList from './ModelList';
import ModelForm from './ModelForm';
import InferenceTest from './InferenceTest';
import AdminDashboard from './AdminDashboard';
import PublishingDashboard from './PublishingDashboard';
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

  const tabs = [
    { id: 'models', label: 'Models', component: ModelList },
    { id: 'create', label: 'Create Model', component: ModelForm },
    { id: 'inference', label: 'Test Inference', component: InferenceTest },
    { id: 'publishing', label: 'Publishing', component: PublishingDashboard },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <nav className="nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        
        <button
          className="btn btn-secondary btn-sm"
          onClick={logout}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {ActiveComponent && <ActiveComponent />}
    </>
  );
};

export default Dashboard;