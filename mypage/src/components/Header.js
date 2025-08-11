import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import GoogleLoginButton from './GoogleLoginButton';
import { AuthContext } from '../context/AuthContext';
// Removed App.css import as its styles are now in Headerbar.css or App.css (general)
import '../style/Headerbar.css'; // Import the new Headerbar.css

const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/30/0000FF/FFFFFF?text=U';

const Header = () => {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const { isAuthenticated, role, userName, userEmail, userPicture, logout } = useContext(AuthContext);

  const handleLogout = () => {
    logout();
    setShowProfilePopup(false); // Close popup after logout
  };

  return (
    <nav className="my-navbar"> {/* Replaced navbar navbar-expand-lg navbar-light bg-light */}
      <div className="Header-container"> {/* Replaced container-fluid */}
        <Link className="my-navbar-brand" to="/">LifeSculpture</Link> {/* Replaced navbar-brand */}
        <button className="my-navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation"> {/* Replaced navbar-toggler */}
          <span className="my-navbar-toggler-icon"></span> {/* Replaced navbar-toggler-icon */}
        </button>
        <div className="my-navbar-collapse" id="navbarNav"> {/* Replaced collapse navbar-collapse */}
          <ul className="my-navbar-nav"> {/* Replaced navbar-nav ms-auto */}
            <li className="my-nav-item"> {/* Replaced nav-item */}
              <Link className="my-nav-link" to="/introduce">Introduce</Link> {/* Replaced nav-link */}
            </li>
            <li className="my-nav-item">
              <Link className="my-nav-link" to="/study">Study</Link>
            </li>
            <li className="my-nav-item">
              <Link className="my-nav-link" to="/blog">Blog</Link>
            </li>
            <li 
              className="my-nav-item my-profile-nav-item"
              onMouseEnter={() => setShowProfilePopup(true)}
              onMouseLeave={() => setShowProfilePopup(false)}
              style={{ position: 'relative' }}
            >
              <span className="my-nav-link" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {isAuthenticated && userPicture ? (
                  <img src={userPicture} alt="Profile" className="profile-pic" />
                ) : (
                  <img src={DEFAULT_PROFILE_PIC} alt="Default Profile" className="profile-pic" />
                )}
              </span>
              {showProfilePopup && (
                <div className="profile-popup">
                  {isAuthenticated ? (
                    <>
                      <p>{userName}</p>
                      <p>로그인 계정: {userEmail}</p>
                      <div className='profile-popup-btns'>
                        {role === 'admin' && (
                          <Link to="/settings" className="btn btn-info btn-sm mt-2" onClick={() => setShowProfilePopup(false)}>Settings</Link>
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