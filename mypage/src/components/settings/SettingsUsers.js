// SettingsUsers 컴포넌트: 관리자용 사용자 목록과 권한 관리 화면
import React, { useState, useEffect, useMemo } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../../firebase/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import '../../style/SettingsUsers.css';

function SettingsUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [qText, setQText] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const [updatingUsers, setUpdatingUsers] = useState(new Set());
  const [viewMode, setViewMode] = useState('view'); // 'view' 또는 'edit'

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      
      // 성공 메시지 (선택사항)
      console.log(`User ${userId} role updated to ${newRole}`);
      
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
    // 특정 계정은 편집 불가
    if (user.email === 'sksksjakskska@gmail.com') {
      return (
        <span className={`role-badge role-${(user.role || 'user').toLowerCase()}`}>
          {user.role === 'admin' ? '관리자' : '일반 사용자'}
        </span>
      );
    }

    return <EditableRoleDropdown user={user} isUpdating={isUpdating} />;
  };

  // 편집 가능한 역할 드롭다운 컴포넌트
  const EditableRoleDropdown = ({ user, isUpdating }) => {
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
        <div key={user.id} className="user-card">
          <div className="user-card-header">
            <div className="user-card-name">{user.name || 'N/A'}</div>
            {viewMode === 'edit' ? null : (
              <span className={`role-badge role-${(user.role || 'user').toLowerCase()}`}>
                {user.role === 'admin' ? '관리자' : '일반 사용자'}
              </span>
            )}
          </div>
          <div className="user-card-email">{user.email}</div>
          {viewMode === 'edit' && user.email !== 'sksksjakskska@gmail.com' && (
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
                  <RoleChangeDropdown 
                    user={user} 
                    isUpdating={updatingUsers.has(user.id)} 
                  />
                </td>
              ) : (
                <td>
                  <span className={`role-badge role-${(user.role || 'user').toLowerCase()}`}>
                    {user.role === 'admin' ? '관리자' : '일반 사용자'}
                  </span>
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
        <main className="settings-users-container">
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
