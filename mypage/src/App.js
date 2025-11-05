import './style/App.css';
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Connect, Header } from './components';
import { AuthContext } from './context/AuthContext';
import HomePage from './pages/HomePage';
import StudyPage from './pages/StudyPage';
import BlogPage from './pages/BlogPage';
import SettingsPage from './pages/SettingsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import EditPostPage from './pages/EditPostPage';
import PostDetailPage from './pages/PostDetailPage';


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
        <Route path="/" element={<HomePage />} />
        <Route path="/study" element={<Page><StudyPage /></Page>} />
        <Route path="/blog" element={<Page><BlogPage /></Page>} />
        <Route path="/settings/*" element={<Page><SettingsPage /></Page>} />

        {role === 'admin' && (
          <Route path="/admin" element={<Page><AdminDashboardPage /></Page>} />
        )}
        {role === 'admin' && (
          <Route path="/edit-post/:category/:id" element={<Page><EditPostPage /></Page>} />
        )}

        <Route path="/posts/:category/:id" element={<Page><PostDetailPage /></Page>} />
      </Routes>

      <Connect />
    </div>
  );
}

export default App;
