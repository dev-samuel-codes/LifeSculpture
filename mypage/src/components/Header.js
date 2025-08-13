import React, { useState, useContext, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GoogleLoginButton from './GoogleLoginButton';
import { AuthContext } from '../context/AuthContext';
import '../style/Headerbar.css';

const DEFAULT_PROFILE_PIC = 'http://localhost:5000/assets/download.png';

const Header = () => {
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const { isAuthenticated, role, userName, userEmail, userPicture, logout } = useContext(AuthContext);

  const profileRef = useRef(null); // 🔹 프로필 팝업 영역 ref

  const handleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);
  const toggleProfilePopup = () => setIsProfilePopupOpen(!isProfilePopupOpen);

  const handleLogout = () => {
    logout();
    setIsProfilePopupOpen(false);
    setIsNavCollapsed(true); // 모바일 시트 닫기
  };

  const closeNav = () => setIsNavCollapsed(true);

  // 🔹 바깥 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfilePopupOpen(false);
      }
    };

    if (isProfilePopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isProfilePopupOpen]);

  return (
    <nav className="my-navbar">
      <div className="Header-container">
        <Link className="my-navbar-brand" to="/" onClick={closeNav}>LifeSculpture</Link>

        {/* 모바일에서 항상 오른쪽 끝 */}
        <button
          className="my-navbar-toggler"
          type="button"
          onClick={handleNavCollapse}
          aria-controls="navbarNav"
          aria-expanded={!isNavCollapsed}
          aria-label="Toggle navigation"
        >
          <span className="my-navbar-toggler-icon" />
        </button>

        <div className={`${isNavCollapsed ? '' : 'show'} my-navbar-collapse`} id="navbarNav">
          <ul className="my-navbar-nav">
            <li className="my-nav-item">
              <Link className="my-nav-link" to="/study" onClick={closeNav}>Study</Link>
            </li>
            <li className="my-nav-item">
              <Link className="my-nav-link" to="/blog" onClick={closeNav}>Blog</Link>
            </li>

            {/* 데스크탑용 프로필 */}
            <li
              className="my-nav-item my-profile-nav-item desktop-only"
              style={{ position: 'relative' }}
              ref={profileRef} // 🔹 ref 연결
            >
              <span
                className="my-nav-link"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onClick={toggleProfilePopup}
              >
                {isAuthenticated && userPicture ? (
                  <img src={userPicture} alt="Profile" className="profile-pic" />
                ) : (
                  <img src={DEFAULT_PROFILE_PIC} alt="Default Profile" className="profile-pic" />
                )}
                <span style={{ fontSize: 16 }}>Profile</span>
              </span>

              {isProfilePopupOpen && (
                <div className="profile-popup">
                  {isAuthenticated ? (
                    <>
                      <p>{userName}</p>
                      <p>로그인 계정: {userEmail}</p>
                      <div className="profile-popup-btns">
                        {role === 'admin' && (
                          <Link
                            to="/settings"
                            className="btn btn-info btn-sm mt-2"
                            onClick={() => {
                              setIsProfilePopupOpen(false);
                              closeNav();
                            }}
                          >
                            Settings
                          </Link>
                        )}
                        <button className="btn btn-danger btn-sm mt-2" onClick={handleLogout}>
                          로그아웃 하기
                        </button>
                      </div>
                    </>
                  ) : (
                    <GoogleLoginButton />
                  )}
                </div>
              )}
            </li>

            {/* 모바일 전용 프로필 카드 */}
            <li className="my-nav-item mobile-only">
              <div className="mobile-profile-card">
                <div className="mobile-profile-row">
                  {isAuthenticated && userPicture ? (
                    <img src={userPicture} alt="Profile" className="profile-pic" />
                  ) : (
                    <img src={DEFAULT_PROFILE_PIC} alt="Default Profile" className="profile-pic" />
                  )}
                  <div>
                    <p className="mobile-profile-name">
                      {isAuthenticated ? userName : '로그인이 필요합니다'}
                    </p>
                    <p className="mobile-profile-email">
                      {isAuthenticated ? `로그인 계정: ${userEmail}` : 'Google 계정으로 로그인하세요'}
                    </p>
                  </div>
                </div>

                {isAuthenticated ? (
                  <div className="profile-popup-btns">
                    {role === 'admin' && (
                      <Link
                        to="/settings"
                        className="btn btn-info"
                        onClick={closeNav}
                      >
                        Settings
                      </Link>
                    )}
                    <button className="btn btn-danger" onClick={handleLogout}>
                      로그아웃 하기
                    </button>
                  </div>
                ) : (
                  <GoogleLoginButton />
                )}
              </div>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Header;
