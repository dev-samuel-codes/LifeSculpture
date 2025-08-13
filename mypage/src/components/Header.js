import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import GoogleLoginButton from './GoogleLoginButton';
import { AuthContext } from '../context/AuthContext';
import '../style/Headerbar.css';

const DEFAULT_PROFILE_PIC = 'http://localhost:5000/assets/download.png';

const Header = () => {
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const { isAuthenticated, role, userName, userEmail, userPicture, logout } = useContext(AuthContext);
  const popupRef = useRef(null);
  const profileBtnRef = useRef(null);

  const handleNavCollapse = () => setIsNavCollapsed(prev => !prev);
  const closeNav = () => setIsNavCollapsed(true);
  const toggleProfilePopup = () => setIsProfilePopupOpen(prev => !prev);

  const handleLogout = () => {
    logout();
    setIsProfilePopupOpen(false);
  };

  // 프로필 팝업 외부 클릭 닫기
  useEffect(() => {
    const onClickOutside = (e) => {
      if (!isProfilePopupOpen) return;
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target) &&
        profileBtnRef.current &&
        !profileBtnRef.current.contains(e.target)
      ) {
        setIsProfilePopupOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isProfilePopupOpen]);

  // 모바일 메뉴 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (!isNavCollapsed) document.body.classList.add('no-scroll');
    else document.body.classList.remove('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [isNavCollapsed]);

  const navClassName = `my-navbar ${!isNavCollapsed ? 'is-open' : ''}`;

  return (
    <nav className={navClassName} role="navigation" aria-label="Main">
      <div className="Header-container">
        {/* 브랜드 */}
        <Link className="my-navbar-brand" to="/" onClick={closeNav}>
          LifeSculpture
        </Link>

        {/* 메뉴(모바일: 슬라이드, 데스크톱: 우측 정렬) */}
        <div className={`${isNavCollapsed ? '' : 'show'} my-navbar-collapse`} id="navbarNav">
          <div className="mobile-menu-header">
            <span>Menu</span>
            <button onClick={closeNav} className="close-menu-btn" aria-label="Close menu">
              &times;
            </button>
          </div>

          <ul className="my-navbar-nav">
            <li className="my-nav-item">
              <Link className="my-nav-link" to="/study" onClick={closeNav}>Study</Link>
            </li>
            <li className="my-nav-item">
              <Link className="my-nav-link" to="/blog" onClick={closeNav}>Blog</Link>
            </li>
            <li className="my-nav-item my-profile-nav-item-container"></li>
          </ul>
        </div>

        {/* 우측: 프로필 → 햄버거 순서 */}
        <div className="navbar-right-items">
          <div className={`my-profile-nav-item ${isProfilePopupOpen ? 'is-open' : ''}`}>
            <button
              ref={profileBtnRef}
              className="my-nav-link profile-trigger"
              aria-haspopup="dialog"
              aria-expanded={isProfilePopupOpen}
              onClick={toggleProfilePopup}
            >
              <img
                src={isAuthenticated && userPicture ? userPicture : DEFAULT_PROFILE_PIC}
                alt="Profile"
                className="profile-pic"
              />
              <span className="sr-only">프로필 열기</span>
            </button>

            {isProfilePopupOpen && (
              <>
                <div className="profile-overlay" onClick={() => setIsProfilePopupOpen(false)}></div>
                <div
                  ref={popupRef}
                  className="profile-popup"
                  role="dialog"
                  aria-modal="true"
                  aria-label="사용자 메뉴"
                >
                  {isAuthenticated ? (
                    <>
                      <p>{userName}</p>
                      <p>로그인 계정: {userEmail}</p>
                      <div className="profile-popup-btns">
                        {role === 'admin' && (
                          <Link
                            to="/settings"
                            className="btn btn-info btn-sm mt-2"
                            onClick={() => setIsProfilePopupOpen(false)}
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
              </>
            )}
          </div>

          {/* 햄버거 버튼: 프로필 오른쪽 */}
          <button
            className="my-navbar-toggler"
            type="button"
            onClick={handleNavCollapse}
            aria-controls="navbarNav"
            aria-expanded={!isNavCollapsed}
            aria-label="Toggle navigation"
          >
            <span className="my-navbar-toggler-icon">
              <span></span>
            </span>
          </button>
        </div>
      </div>

      {/* 메뉴 열렸을 때 배경 오버레이 */}
      {!isNavCollapsed && <div className="nav-overlay" onClick={closeNav} />}
    </nav>
  );
};

export default Header;
