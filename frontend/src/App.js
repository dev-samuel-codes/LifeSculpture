import './style/App.css';
import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Connect from './components/layout/Connect';
import FullPageLoading from './components/layout/FullPageLoading';
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
  const { role, uid, loading: authLoading } = React.useContext(AuthContext);
  const location = useLocation();
  const isEditorRoute =
    location.pathname === '/write' || location.pathname.startsWith('/edit-post/');

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

  useEffect(() => {
    if (role !== 'admin' || !uid) return;
    Promise.all([
      import('./firebase/firebase'),
      import('./services/postDeletion'),
      import('./services/postCategoryMove'),
      import('./utils/storage'),
    ]).then(([
      firebaseModule,
      deletionModule,
      moveModule,
      storageModule,
    ]) => Promise.allSettled([
      deletionModule.retryPendingPostDeletionCleanups({
        storage: firebaseModule.storage,
        uid,
        role,
      }),
      moveModule.retryPendingPostMoveRecoveries({
        storage: firebaseModule.storage,
        uid,
        role,
        deleteImages: storageModule.deleteStorageImages,
      }),
    ])).then((results) => {
      if (process.env.NODE_ENV !== 'production' &&
          results.some((result) => result.status === 'rejected')) {
        console.warn('보류 중인 게시물 작업을 일부 완료하지 못했습니다.');
      }
    }).catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('게시물 복구 모듈을 불러오지 못했습니다.', error);
      }
    });
  }, [role, uid]);

  if (authLoading) {
    return <FullPageLoading />;
  }

  return (
    <div className="App">
      <Header />

      <Suspense fallback={<FullPageLoading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/study" element={<Page className="post-collection-route-page"><StudyPage /></Page>} />
          <Route path="/blog" element={<Page className="post-collection-route-page"><BlogPage /></Page>} />

          {role === 'admin' && (
            <Route path="/admin" element={<Page><AdminDashboardPage /></Page>} />
          )}
          {role === 'admin' && (
            <Route path="/write" element={<Page className="editor-route-page"><WritePostPage /></Page>} />
          )}
          {role === 'admin' && (
            <Route path="/edit-post/:category/:id" element={<Page className="editor-route-page"><EditPostPage /></Page>} />
          )}

          <Route path="/posts/:category/:id" element={<Page className="post-detail-route-page"><PostDetailPage /></Page>} />
        </Routes>
      </Suspense>

      {!isEditorRoute && <Connect />}

    </div>
  );
}

export default App;
