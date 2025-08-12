// src/components/SettingsUsers.js
import React, { useState, useEffect, useMemo } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import '../style/SettingsUsers.css';

function SettingsUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [qText, setQText] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setError(null);
      setUsers([]);

      if (!user) {
        setLoading(false);
        setError('로그인이 필요합니다.');
        return;
      }

      try {
        setLoading(true);

        // 1) 내 문서에서 admin 여부 확인
        const meSnap = await getDoc(doc(db, 'users', user.uid));
        const isAdmin = meSnap.exists() && meSnap.data()?.role === 'admin';
        if (!isAdmin) {
          setLoading(false);
          setError('권한이 없습니다 (admin만 접근).');
          return;
        }

        // 2) admin이면 전체 users 읽기
        const qy = query(collection(db, 'users'), orderBy('email', 'asc'));
        const snap = await getDocs(qy);

        // ✅ admin 먼저 오도록 정렬(+ 같은 role 내에서 email 오름차순 유지)
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const aIsAdmin = (a.role || '').toLowerCase() === 'admin';
            const bIsAdmin = (b.role || '').toLowerCase() === 'admin';
            if (aIsAdmin !== bIsAdmin) return aIsAdmin ? -1 : 1; // admin 우선
            return (a.email || '').localeCompare(b.email || '');
          });

        setUsers(sorted);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // 검색/역할 필터
  const filtered = useMemo(() => {
    const term = qText.trim().toLowerCase();
    return users.filter(u => {
      const matchText =
        !term ||
        (u.name  || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term);
      const matchRole = roleFilter === 'all' || (u.role || 'user') === roleFilter;
      return matchText && matchRole;
    });
  }, [users, qText, roleFilter]);

  return (
    <div className="container mt-4 h-100">
      <div className="settings-layout">
        <SettingsMenu />
        <main className="settings-users-container">
          <header className="users-header">
            <div><h3>Users Management</h3></div>
            <div className="users-tools">
              <input
                type="search"
                className="users-search"
                placeholder="Search"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                aria-label="Search users"
              />
              <select
                className="users-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
              >
                <option value="all">Role</option>
                <option value="admin">admin</option>
                <option value="user">user</option>
              </select>
            </div>
          </header>

          {loading && (
            <div className="users-skeleton">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-row">
                  <span className="sk sk-name" />
                  <span className="sk sk-email" />
                  <span className="sk sk-role" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="text-danger">Error: {error}</p>
          )}

          {!loading && !error && (
            <>
              {filtered.length === 0 ? (
                <div className="users-empty">
                  <p>검색 결과가 없습니다.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((user) => (
                        <tr key={user.id}>
                          <td>{user.name || 'N/A'}</td>
                          <td>{user.email}</td>
                          <td>
                            <span className={`role-badge role-${(user.role || 'user').toLowerCase()}`}>
                              {user.role || 'user'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default SettingsUsers;
