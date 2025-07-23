import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ApiProvider } from './contexts/ApiContext';

function AppContent() {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #1C76FD 0%, #5721F0 100%)'
      }}>
        <div style={{ 
          background: 'white', 
          padding: '2rem', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!token) {
    return <Login />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1 style={{ color: '#FFFFFF', fontFamily: 'Poppins, sans-serif', fontWeight: '600' }}>Inference-in-a-Box</h1>
        <div className="tenant-info" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
          Tenant: {user?.tenant} | User: {user?.name || user?.sub}
        </div>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/models" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ApiProvider>
        <AppContent />
        <Toaster position="top-right" />
      </ApiProvider>
    </AuthProvider>
  );
}

export default App;