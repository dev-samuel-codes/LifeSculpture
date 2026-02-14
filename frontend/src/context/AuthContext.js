// src/context/AuthContext.js
import React, { createContext, useMemo } from 'react';
import { useAuthSession } from '../hooks/useAuthSession';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const {
    isAuthenticated,
    role,
    userName,
    userEmail,
    userPicture,
    uid,
    loading,
    login,
    logout,
  } = useAuthSession();

  const value = useMemo(
    () => ({ isAuthenticated, role, userName, userEmail, userPicture, uid, loading, login, logout }),
    [isAuthenticated, role, userName, userEmail, userPicture, uid, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
