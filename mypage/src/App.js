import './style/App.css';
import React from 'react'; // Removed useState, useContext
import { Routes, Route, Link } from 'react-router-dom';
import Introduce from './components/Introduce';
import Study from './components/Study';
import Blog from './components/Blog';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import Settings from './components/Settings';
import PostDetail from './components/PostDetail';
// Removed GoogleLoginButton import as it's now in Header.js
import EditPost from './components/EditPost';
import { AuthContext } from './context/AuthContext'; // Still needed for role check in routes
import Header from './components/Header'; // Import the new Header component

// Removed DEFAULT_PROFILE_PIC as it's now in Header.js

function Home() {
  return (
    <div>
      <h2>Welcome to LifeSculpture!</h2>
      <p>This is the main page content.</p>
    </div>
  );
}

function App() {
  // Removed showProfilePopup state and handleLogout function as they are now in Header.js
  const { role } = React.useContext(AuthContext); // Only need role for route rendering

  return (
    <div className="App">
      <Header /> {/* Render the new Header component */}

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