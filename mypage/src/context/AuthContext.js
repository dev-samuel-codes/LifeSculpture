import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  const decodeToken = (token) => {
    try {
      const decoded = jwtDecode(token);
      return decoded;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };

  const login = (token) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    const decoded = decodeToken(token);
    if (decoded) {
      setRole(decoded.role);
      setUserName(decoded.name);
      setUserEmail(decoded.email);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setRole(null);
    setUserName(null);
    setUserEmail(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setIsAuthenticated(true);
        setRole(decoded.role);
        setUserName(decoded.name);
        setUserEmail(decoded.email);
      } else {
        // Token is invalid, clear it
        logout();
      }
    } else {
      setIsAuthenticated(false);
      setRole(null);
      setUserName(null);
      setUserEmail(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, userName, userEmail, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
