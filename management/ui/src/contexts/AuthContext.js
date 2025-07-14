import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      try {
        // Handle super admin token
        if (token === 'super-admin-token') {
          setUser({
            tenant: 'admin',
            name: 'Super Admin',
            role: 'admin',
            isAdmin: true,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
          });
        } else {
          // Decode JWT token to get user info
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser(payload);
        }
      } catch (error) {
        console.error('Invalid token:', error);
        logout();
      }
    }
    setLoading(false);
  }, [token]);

  const login = (newToken) => {
    console.log('AuthContext - login called with token:', newToken);
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    
    try {
      // Handle super admin token
      if (newToken === 'super-admin-token') {
        const adminUser = {
          tenant: 'admin',
          name: 'Super Admin',
          role: 'admin',
          isAdmin: true,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        };
        console.log('AuthContext - setting admin user:', adminUser);
        setUser(adminUser);
      } else {
        // Decode JWT token to get user info
        const payload = JSON.parse(atob(newToken.split('.')[1]));
        console.log('AuthContext - setting regular user:', payload);
        setUser(payload);
      }
    } catch (error) {
      console.error('Invalid token:', error);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};