import React, { useEffect } from 'react';
import GoogleLoginButton from './GoogleLoginButton';
import '../style/LoginRequiredPopup.css';

function LoginRequiredPopup({
  isOpen,
  onClose,
  message = '로그인이 필요한 기능입니다.',
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="login-popup-overlay" onClick={onClose}>
      <div
        className="login-popup-content"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-popup-title"
      >
        <button className="close-button" type="button" onClick={onClose} aria-label="\uB2EB\uAE30">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="login-popup-hero">
          <div className="login-popup-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <defs>
                <linearGradient id="login-lock" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
              <path
                fill="url(#login-lock)"
                d="M34 20h-1v-6c0-5.52-4.48-10-10-10s-10 4.48-10 10v6h-1c-2.76 0-5 2.24-5 5v16c0 2.76 2.24 5 5 5h22c2.76 0 5-2.24 5-5V25c0-2.76-2.24-5-5-5zm-16-6c0-2.76 2.24-5 5-5s5 2.24 5 5v6H18v-6zm7 18.73V36a2 2 0 1 1-4 0v-3.27a4.002 4.002 0 1 1 4 0z"
              />
            </svg>
          </div>
          <div className="login-popup-text">
            <h3 id="login-popup-title">로그인이 필요한 기능입니다</h3>
            <p className="login-popup-message">{message}</p>
            <p className="login-popup-description">
              3초면 끝! Google 계정으로 간편하게 로그인하고 공감하기를 포함한 모든 기능을 즐겨보세요.
            </p>
          </div>
        </div>

        <div className="login-popup-actions">
          <GoogleLoginButton className="login-popup-login-button" />
          <button className="login-popup-cancel" type="button" onClick={onClose}>
            다음에 할래요.
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginRequiredPopup;

