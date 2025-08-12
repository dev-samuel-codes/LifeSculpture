import './style/App.css';
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Introduce from './components/Introduce';
import Study from './components/Study';
import Blog from './components/Blog';
import Connect from './components/Connect';

import AdminDashboard from './components/AdminDashboard';
import Settings from './components/Settings';
import PostDetail from './components/PostDetail';
import EditPost from './components/EditPost';
import { AuthContext } from './context/AuthContext';
import Header from './components/Header';

import coding from './assets/coding.jpg';
import ai from './assets/ai.jpg';
import travel from './assets/travel.webp';
import tip from './assets/tip.jpg';

// 페이지 공통 래퍼 (홈 제외)
function Page({ children }) {
  return <div className="container mt-4 min-vh-100">{children}</div>;
}

function App() {
  const { role, loading } = React.useContext(AuthContext);

  if (loading) {
    return (
      <div className="App">
        <Header />
        <div style={{ padding: 16 }}>Loading session…</div>
        <Connect />
      </div>
    );
  }

  return (
    <div className="App">
      <Header />

      <Routes>
        <Route path="/" element={<div></div>} />
        <Route path="/introduce" element={<Page><Introduce /></Page>} />
        <Route path="/study" element={<Page><Study /></Page>} />
        <Route path="/blog" element={<Page><Blog /></Page>} />
        <Route path="/settings/*" element={<Page><Settings /></Page>} />

        {role === 'admin' && (
          <Route path="/admin" element={<Page><AdminDashboard /></Page>} />
        )}
        {role === 'admin' && (
          <Route path="/edit-post/:category/:id" element={<Page><EditPost /></Page>} />
        )}

        <Route path="/posts/:category/:id" element={<Page><PostDetail /></Page>} />
      </Routes>

      <Connect />
    </div>
  );
}

export default App;
