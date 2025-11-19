import './style/App.css';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Connect, Header } from './components';
import { AuthContext } from './context/AuthContext';
import LoadingScreen from './components/common/LoadingScreen';

const HomePage = lazy(() => import('./pages/HomePage'));
const StudyPage = lazy(() => import('./pages/StudyPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const EditPostPage = lazy(() => import('./pages/EditPostPage'));
const PostDetailPage = lazy(() => import('./pages/PostDetailPage'));

// 페이지 공통 래퍼 (홈 제외)
function Page({ children }) {
  return <div className="container mt-4 min-vh-100">{children}</div>;
}

function App() {
  const { role, loading: authLoading } = React.useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 초기 로딩 시뮬레이션
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // 2초 후에 로딩 화면 제거

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="App">
      <Header />

      {authLoading ? (
        <>
          <div style={{ padding: 16 }}>Loading session…</div>
          <Connect />
        </>
      ) : (
        <>
          <Suspense fallback={<div className="route-loading">페이지를 불러오는 중...</div>}>
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
          </Suspense>

          <Connect />
        </>
      )}

      {isLoading && <LoadingScreen />}
    </div>
  );
}

export default App;
