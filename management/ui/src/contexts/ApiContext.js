import React, { createContext, useContext } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const ApiContext = createContext();

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

export const ApiProvider = ({ children }) => {
  const { token } = useAuth();

  // Configure axios instance
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || '/api',
    timeout: 30000,
  });

  // Add auth token to requests
  api.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // API methods
  const apiMethods = {
    // Authentication
    getTokens: () => api.get('/tokens'),
    getTenantInfo: () => api.get('/tenant'),
    adminLogin: (credentials) => api.post('/admin/login', credentials),
    
    // Models
    getModels: () => api.get('/models'),
    getModel: (name) => api.get(`/models/${name}`),
    createModel: (data) => api.post('/models', data),
    updateModel: (name, data) => api.put(`/models/${name}`, data),
    deleteModel: (name) => api.delete(`/models/${name}`),
    
    // Inference
    predict: (modelName, inputData, connectionSettings = null) => 
      api.post(`/models/${modelName}/predict`, { inputData, connectionSettings }),
    
    // Monitoring
    getModelLogs: (modelName, lines = 100) => api.get(`/models/${modelName}/logs?lines=${lines}`),
    
    // Frameworks
    getFrameworks: () => api.get('/frameworks'),
    
    // Model Publishing
    publishModel: (modelName, publishConfig) => api.post(`/models/${modelName}/publish`, publishConfig),
    updatePublishedModel: (modelName, publishConfig) => api.put(`/models/${modelName}/publish`, publishConfig),
    unpublishModel: (modelName) => {
      return api.delete(`/models/${modelName}/publish`);
    },
    getPublishedModel: (modelName, namespace = null) => {
      const params = namespace ? { namespace } : {};
      return api.get(`/models/${modelName}/publish`, { params });
    },
    getPublishedModels: () => api.get('/published-models'),
    rotateAPIKey: (modelName, namespace = null) => {
      const params = namespace ? { namespace } : {};
      return api.post(`/models/${modelName}/publish/rotate-key`, {}, { params });
    },
    validateAPIKey: (apiKey) => api.post('/validate-api-key', { apiKey }),

    // Admin endpoints
    getSystemInfo: () => api.get('/admin/system'),
    getTenants: () => api.get('/admin/tenants'),
    getResources: () => api.get('/admin/resources'),
    getAdminLogs: (params = {}) => api.get('/admin/logs', { params }),
    executeKubectl: (command) => api.post('/admin/kubectl', { command }),
  };

  return (
    <ApiContext.Provider value={apiMethods}>
      {children}
    </ApiContext.Provider>
  );
};