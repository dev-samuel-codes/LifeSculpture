import React from 'react';
import GoogleLoginButton from './GoogleLoginButton';
import '../style/LoginRequiredPopup.css';

function LoginRequiredPopup({ isOpen, onClose, message = "로그인이 필요한 기능입니다" }) {
  if (!isOpen) return null;

  return (
    <div className="login-popup-overlay" onClick={onClose}>
      <div className="login-popup-content" onClick={(e) => e.stopPropagation()}>
        <div className="login-popup-header">
          <h3>로그인 필요</h3>
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        <div className="login-popup-body">
          <div className="login-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <p className="login-message">{message}</p>
          <p className="login-description">이 기능을 사용하려면 Google 계정으로 로그인해주세요.</p>
        </div>
        
        <div className="login-popup-footer">
          <GoogleLoginButton />
          <button className="cancel-button" onClick={onClose}>
            나중에 하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginRequiredPopup;
