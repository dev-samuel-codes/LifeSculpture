import { useEffect, useState, useCallback } from 'react';
import { auth, db, googleProvider } from '../firebase/firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export function useAuthSession() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userPicture, setUserPicture] = useState(null);
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setIsAuthenticated(false);
          setRole(null);
          setUserName(null);
          setUserEmail(null);
          setUserPicture(null);
          setUid(null);
          return;
        }

        setIsAuthenticated(true);
        setUserName(user.displayName || null);
        setUserEmail(user.email || null);
        setUserPicture(user.photoURL || null);
        setUid(user.uid);

        try {
          const snapshot = await getDoc(doc(db, 'users', user.uid));
          const resolvedRole = snapshot.exists() ? snapshot.data()?.role ?? null : null;
          setRole(resolvedRole);
        } catch (error) {
          console.error('[useAuthSession] failed to fetch role:', error);
          setRole(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await fbSignOut(auth);
    setIsAuthenticated(false);
    setRole(null);
    setUserName(null);
    setUserEmail(null);
    setUserPicture(null);
    setUid(null);
  }, []);

  return {
    isAuthenticated,
    role,
    userName,
    userEmail,
    userPicture,
    uid,
    loading,
    login,
    logout,
  };
}
