// GoogleLoginButton 컴포넌트: Google 로그인 플로우를 실행하는 버튼
import React, { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

function GoogleLoginButton({ redirectTo = '/', className = '' }) {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useContext(AuthContext);

  const mergedClassName = useMemo(
    () => ['btn', 'btn-primary', className].filter(Boolean).join(' '),
    [className],
  );

  const handleLogin = async () => {
    try {
      await login();
      navigate(redirectTo);
    } catch (err) {
      console.error('[GoogleLoginButton] error:', err);
      alert('Google 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <button type="button" className={mergedClassName} onClick={handleLogin}>
      Google로 로그인
    </button>
  );
}

export default GoogleLoginButton;
