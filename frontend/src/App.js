import './style/App.css';
import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Connect from './components/layout/Connect';
import { AuthContext } from './context/AuthContext';

const HomePage = lazy(() => import('./pages/HomePage'));
const StudyPage = lazy(() => import('./pages/StudyPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const WritePostPage = lazy(() => import('./components/write/WritePostPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const EditPostPage = lazy(() => import('./pages/EditPostPage'));
const PostDetailPage = lazy(() => import('./pages/PostDetailPage'));

const preloadStudyPage = () => import('./pages/StudyPage');
const preloadBlogPage = () => import('./pages/BlogPage');
const preloadPostDetailPage = () => import('./pages/PostDetailPage');

// 페이지 공통 래퍼 (홈 제외)
function Page({ children, className = '' }) {
  const pageClassName = ['container', 'mt-4', 'min-vh-100', className]
    .filter(Boolean)
    .join(' ');
  return <div className={pageClassName}>{children}</div>;
}

function App() {
  const { role, loading: authLoading } = React.useContext(AuthContext);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const prefetch = () => {
      preloadStudyPage();
      preloadBlogPage();
      preloadPostDetailPage();
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 1200 });
      return () => window.cancelIdleCallback?.(id);
    }

    const timer = setTimeout(prefetch, 600);
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

              {role === 'admin' && (
                <Route path="/admin" element={<Page><AdminDashboardPage /></Page>} />
              )}
              {(role === 'admin' || process.env.NODE_ENV === 'development') && (
                <Route path="/write" element={<Page className="editor-route-page"><WritePostPage /></Page>} />
              )}
              {(role === 'admin' || process.env.NODE_ENV === 'development') && (
                <Route path="/edit-post/:category/:id" element={<Page className="editor-route-page"><EditPostPage /></Page>} />
              )}

              <Route path="/posts/:category/:id" element={<Page><PostDetailPage /></Page>} />
            </Routes>
          </Suspense>

          <Connect />
        </>
      )}

    </div>
  );
}

export default App;
