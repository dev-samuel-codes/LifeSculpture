// src/components/GoogleLoginButton.js
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function GoogleLoginButton({ redirectTo = '/' }) {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useContext(AuthContext);

  const handleLogin = async () => {
    try {
      const user = await login(); // AuthContext.login -> signInWithPopup 호출
      console.log('[GoogleLoginButton] login:', user.uid, user.email);
      navigate(redirectTo);
    } catch (err) {
      console.error('[GoogleLoginButton] error:', err);
      alert('Google 로그인에 실패했어요.');
    }
  };

  // 이미 로그인 상태라면 버튼 숨김(원하면 다른 UI 노출)
  if (isAuthenticated) {
    return null;
  }

  return (
    <button className="btn btn-primary" onClick={handleLogin}>
      Google 로그인
    </button>
  );
}

export default GoogleLoginButton;
