import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ApiProvider } from './contexts/ApiContext';

function AppContent() {
  const { token, user } = useAuth();

  if (!token) {
    return <Login />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>AI Model Management</h1>
        <div className="tenant-info">
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