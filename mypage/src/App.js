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

const TABLET_MAX_WIDTH = 1200;
const TABLET_ASPECT_RATIO = 16 / 10;
const TABLET_ASPECT_TOLERANCE = 0.03;

function useTabletHoverGuard() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const applyClass = () => {
      const { innerWidth: width, innerHeight: height } = window;
      const aspectRatio = height === 0 ? 0 : width / height;
      const isTabletWidth = width <= TABLET_MAX_WIDTH;
      const isSixteenTen =
        height > 0 && Math.abs(aspectRatio - TABLET_ASPECT_RATIO) <= TABLET_ASPECT_TOLERANCE;
      const shouldDisableHover = isTabletWidth || isSixteenTen;

      document.body.classList.toggle('tablet-no-hover', shouldDisableHover);
    };

    applyClass();
    window.addEventListener('resize', applyClass);
    window.addEventListener('orientationchange', applyClass);

    return () => {
      window.removeEventListener('resize', applyClass);
      window.removeEventListener('orientationchange', applyClass);
      document.body.classList.remove('tablet-no-hover');
    };
  }, []);
}


// 페이지 공통 래퍼 (홈 제외)
function Page({ children }) {
  return <div className="container mt-4 min-vh-100">{children}</div>;
}

function App() {
  const { role, loading: authLoading } = React.useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true);
  useTabletHoverGuard();

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
