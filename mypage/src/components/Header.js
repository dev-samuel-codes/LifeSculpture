import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import GoogleLoginButton from './GoogleLoginButton';
import { AuthContext } from '../context/AuthContext';
import '../style/Headerbar.css';

const DEFAULT_PROFILE_PIC = 'http://localhost:5000/assets/download.png';

const Header = () => {
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const { isAuthenticated, role, userName, userEmail, userPicture, logout } = useContext(AuthContext);

  const handleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);
  const toggleProfilePopup = () => setIsProfilePopupOpen(!isProfilePopupOpen);

  const handleLogout = () => {
    logout();
    setIsProfilePopupOpen(false);
  };

  return (
    <nav className="my-navbar">
      <div className="Header-container">
        <Link className="my-navbar-brand" to="/">LifeSculpture</Link>
        <button 
          className="my-navbar-toggler" 
          type="button" 
          onClick={handleNavCollapse} 
          aria-controls="navbarNav" 
          aria-expanded={!isNavCollapsed} 
          aria-label="Toggle navigation"
        >
          <span className="my-navbar-toggler-icon"></span>
        </button>
        <div className={`${isNavCollapsed ? '' : 'show'} my-navbar-collapse`} id="navbarNav">
          <ul className="my-navbar-nav">
            <li className="my-nav-item">
              <Link className="my-nav-link" to="/study" onClick={() => setIsNavCollapsed(true)}>Study</Link>
            </li>
            <li className="my-nav-item">
              <Link className="my-nav-link" to="/blog" onClick={() => setIsNavCollapsed(true)}>Blog</Link>
            </li>
            <li 
              className="my-nav-item my-profile-nav-item"
              style={{ position: 'relative' }}
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
              </span>
              {isProfilePopupOpen && (
                <div className="profile-popup">
                  {isAuthenticated ? (
                    <>
                      <p>{userName}</p>
                      <p>로그인 계정: {userEmail}</p>
                      <div className='profile-popup-btns'>
                        {role === 'admin' && (
                          <Link to="/settings" className="btn btn-info btn-sm mt-2" onClick={() => setIsProfilePopupOpen(false)}>Settings</Link>
                        )}
                        <button className="btn btn-danger btn-sm mt-2" onClick={handleLogout}>로그아웃 하기</button>
                      </div>
                    </>
                  ) : (
                    <GoogleLoginButton />
                  )}
                </div>
              )}
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Header;
