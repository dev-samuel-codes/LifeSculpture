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
import { AuthContext } from './context/AuthContext';

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
  const { isAuthenticated, role, userName, userEmail, logout } = useContext(AuthContext);

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
                <span className="nav-link" style={{ cursor: 'pointer' }}>Profile</span>
                {showProfilePopup && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      padding: '10px',
                      zIndex: 1000,
                      minWidth: '150px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}
                  >
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
                      <Link to="/login" className="btn btn-primary btn-sm" onClick={() => setShowProfilePopup(false)}>Login</Link>
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
        </Routes>
      </div>
    </div>
  );
}

export default App;