// SettingsUsers 컴포넌트: 관리자용 사용자 목록과 권한 관리 화면
import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../../firebase/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import '../../style/components/settings/SettingsUsers.css';
import { AuthContext } from '../../context/AuthContext';

const PROTECTED_ADMIN_EMAIL = 'sksksjakskska@gmail.com';

const RoleBadge = ({ role }) => (
  <span className={`settings-badge role-badge role-${(role || 'user').toLowerCase()}`}>
    {role === 'admin' ? '관리자' : '일반 사용자'}
  </span>
);

function SettingsUsers() {
  const { role, uid, isAuthenticated, loading: authLoading } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [qText, setQText] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const [updatingUsers, setUpdatingUsers] = useState(new Set());
  const [viewMode, setViewMode] = useState('view'); // 'view' 또는 'edit'
  const canEditRole = (user) => viewMode === 'edit' && (user?.email || '') !== PROTECTED_ADMIN_EMAIL;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const qy = query(collection(db, 'users'), orderBy('email', 'asc'));
      const snap = await getDocs(qy);
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aIsAdmin = (a.role || '').toLowerCase() === 'admin';
          const bIsAdmin = (b.role || '').toLowerCase() === 'admin';
          if (aIsAdmin !== bIsAdmin) return aIsAdmin ? -1 : 1;
          return (a.email || '').localeCompare(b.email || '');
        });

      setUsers(sorted);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('사용자 목록을 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !uid) {
      setUsers([]);
      setError('로그인이 필요합니다.');
      setLoading(false);
      return;
    }

    if (role !== 'admin') {
      setUsers([]);
      setError('권한이 없습니다 (admin만 접근).');
      setLoading(false);
      return;
    }

    fetchUsers();
  }, [authLoading, fetchUsers, isAuthenticated, role, uid]);

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

  // 사용자 역할 변경 함수
  const handleRoleChange = async (userId, newRole) => {
    if (!userId || !newRole) return;
    
    setUpdatingUsers(prev => new Set(prev).add(userId));
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      
      // 로컬 상태 업데이트
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
    } catch (err) {
      console.error('Error updating user role:', err);
      setError('사용자 역할 변경에 실패했습니다.');
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // 역할 변경 UI 컴포넌트
  const RoleChangeDropdown = ({ user, isUpdating }) => {
    const [localRole, setLocalRole] = useState(user.role || 'user');
    
    const handleSave = () => {
      if (localRole !== user.role) {
        handleRoleChange(user.id, localRole);
      }
    };
    
    return (
      <div className="role-change-container">
        <select
          className="role-change-select"
          value={localRole}
          onChange={(e) => setLocalRole(e.target.value)}
          disabled={isUpdating}
        >
          <option value="user">일반 사용자</option>
          <option value="admin">관리자</option>
        </select>
        <button
          className={`role-change-btn ${localRole !== user.role ? 'role-change-btn-active' : ''}`}
          onClick={handleSave}
          disabled={isUpdating || localRole === user.role}
        >
          {isUpdating ? '저장 중...' : '저장'}
        </button>
      </div>
    );
  };

  // 모바일용 카드 렌더링
  const renderMobileCards = () => (
    <div className="users-mobile-cards">
      {filtered.map((user) => (
        <div key={user.id} className="settings-surface user-card">
          <div className="user-card-header">
            <div className="user-card-name">{user.name || 'N/A'}</div>
            {viewMode === 'edit' ? null : <RoleBadge role={user.role} />}
          </div>
          <div className="user-card-email">{user.email}</div>
          {canEditRole(user) && (
            <div className="user-card-role-change">
              <RoleChangeDropdown 
                user={user} 
                isUpdating={updatingUsers.has(user.id)} 
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // 데스크탑용 테이블 렌더링
  const renderDesktopTable = () => (
    <div className="table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            {viewMode === 'edit' ? <th>Actions</th> : <th>Role</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((user) => (
            <tr key={user.id}>
              <td>{user.name || 'N/A'}</td>
              <td>{user.email}</td>
              {viewMode === 'edit' ? (
                <td>
                  {canEditRole(user) ? (
                    <RoleChangeDropdown
                      user={user}
                      isUpdating={updatingUsers.has(user.id)}
                    />
                  ) : (
                    <RoleBadge role={user.role} />
                  )}
                </td>
              ) : (
                <td>
                  <RoleBadge role={user.role} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="container mt-4 h-100">
      <div className="settings-layout">
        <SettingsMenu />
        <main className="settings-card settings-users-container">
          <header className={`users-header ${isMobile ? 'users-header-mobile' : ''}`}>
            <div className="users-header-title">
              <h3>Users Management</h3>
            </div>
            <div className={`users-tools ${isMobile ? 'users-tools-mobile' : ''}`}>
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
                value={`${roleFilter}-${viewMode}`}
                onChange={(e) => {
                  const [newRoleFilter, newViewMode] = e.target.value.split('-');
                  setRoleFilter(newRoleFilter);
                  setViewMode(newViewMode);
                }}
                aria-label="Filter and view mode"
              >
                <option value="all-view">전체 사용자 보기</option>
                <option value="admin-view">관리자 보기</option>
                <option value="user-view">일반 사용자 보기</option>
                <option value="all-edit">사용자 역할 설정</option>
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
                isMobile ? renderMobileCards() : renderDesktopTable()
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default SettingsUsers;
