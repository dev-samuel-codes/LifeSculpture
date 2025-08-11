import './App.css';
import React, { useState, useContext } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Introduce from './components/Introduce';
import Study from './components/Study';
import Blog from './components/Blog';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import Settings from './components/Settings';
import PostDetail from './components/PostDetail';
import GoogleLoginButton from './components/GoogleLoginButton'; // Import the new component
import EditPost from './components/EditPost'; // Import EditPost component
import { AuthContext } from './context/AuthContext';

const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/30/0000FF/FFFFFF?text=U';

function Home() {
  return (
    <div>
      <h2>Welcome to LifeSculpture!</h2>
      <p>This is the main page content.</p>
    </div>
  );
}

function App() {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const { isAuthenticated, role, userName, userEmail, userPicture, logout } = useContext(AuthContext);

  const handleLogout = () => {
    logout();
    setShowProfilePopup(false); // Close popup after logout
  };

  return (
    <div className="App">
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/">LifeSculpture</Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/introduce">Introduce</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/study">Study</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/blog">Blog</Link>
              </li>
              <li 
                className="nav-item"
                onMouseEnter={() => setShowProfilePopup(true)}
                onMouseLeave={() => setShowProfilePopup(false)}
                style={{ position: 'relative' }}
              >
                <span className="nav-link" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
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
                        <p>Name: {userName}</p>
                        <p>Email: {userEmail}</p>
                        <p>Role: {role}</p>
                        {role === 'admin' && (
                          <Link to="/settings" className="btn btn-info btn-sm mt-2" onClick={() => setShowProfilePopup(false)}>Settings</Link>
                        )}
                        <button className="btn btn-danger btn-sm mt-2" onClick={handleLogout}>Logout</button>
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

      <div className="container mt-4 min-vh-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/introduce" element={<Introduce />} />
          <Route path="/study" element={<Study />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/login" element={<Login />} />
          {/* AdminDashboard route is still here, but not linked from Navbar directly */}
          {role === 'admin' && (
            <Route path="/admin" element={<AdminDashboard />} />
          )}
          {role === 'admin' && (
            <Route path="/settings/*" element={<Settings />} />
          )}
          <Route path="/posts/:category/:id" element={<PostDetail />} />
          {role === 'admin' && (
            <Route path="/edit-post/:category/:id" element={<EditPost />} />
          )}
        </Routes>
      </div>
    </div>
  );
}

export default App;
