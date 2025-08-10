import './App.css';
import React, { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Introduce from './components/Introduce';
import Study from './components/Study';
import Blog from './components/Blog';

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
                    <p>Name: John Doe</p>
                    <p>Email: john.doe@example.com</p>
                    <p>Occupation: Developer</p>
                  </div>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <div className="container mt-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/introduce" element={<Introduce />} />
          <Route path="/study" element={<Study />} />
          <Route path="/blog" element={<Blog />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;