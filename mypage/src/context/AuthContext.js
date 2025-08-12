// src/context/AuthContext.js
import React, { createContext, useEffect, useState, useCallback, useMemo } from 'react';
import { auth, db, googleProvider } from '../firebase/firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userPicture, setUserPicture] = useState(null);
  const [loading, setLoading] = useState(true); // 초기 세션 로딩

  // Firebase 세션 구독 + Firestore의 users/{uid}에서 role 로드
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setIsAuthenticated(false);
          setRole(null);
          setUserName(null);
          setUserEmail(null);
          setUserPicture(null);
          return;
        }

        setIsAuthenticated(true);
        setUserName(u.displayName || null);
        setUserEmail(u.email || null);
        setUserPicture(u.photoURL || null);

        // Firestore: users/{uid}.role 읽어 admin 여부 판단
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          const r = snap.exists() ? (snap.data()?.role ?? null) : null;
          setRole(r);
        } catch (e) {
          console.error('[AuthContext] failed to fetch role:', e);
          setRole(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // 기존 호출부 호환을 위해 login() 이름은 유지 (토큰 인자 불필요)
  const login = useCallback(async () => {
    const res = await signInWithPopup(auth, googleProvider);
    // 필요하면 최초 로그인 시 users/{uid} 문서를 자동 생성하도록 확장 가능
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await fbSignOut(auth);
    setIsAuthenticated(false);
    setRole(null);
    setUserName(null);
    setUserEmail(null);
    setUserPicture(null);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, role, userName, userEmail, userPicture, loading, login, logout }),
    [isAuthenticated, role, userName, userEmail, userPicture, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export function useAuth() {
  return React.useContext(AuthContext);
}
