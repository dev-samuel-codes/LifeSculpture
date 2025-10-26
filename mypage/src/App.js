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
import './style/Home.css';

import LazyBackgroundImage from './components/LazyBackgroundImage';
import useStorageImage from './hooks/useStorageImage';

// 홈 화면
function Home() {
  const mainBackground = useStorageImage('image/MainBackgroundImage.png');
  const codingImage = useStorageImage('image/coding.jpg');
  const aiImage = useStorageImage('image/ai.jpg');
  const travelImage = useStorageImage('image/travel.jpg');
  const tipImage = useStorageImage('image/tip.jpg');

  return (
    <div>
      <div
        className='main-section1'
        style={mainBackground.url ? { backgroundImage: `url(${mainBackground.url})` } : undefined}
        data-loading={mainBackground.loading || !mainBackground.url}
      >
        <h2>Every Day, A New Page</h2>
      </div>

      <div className='main-section2'>
        <div className='main-section2-title'>Contents</div>

        <div className='main-section2-content'>
          {/* Study ?? 1 */}
          <LazyBackgroundImage
            src={codingImage.url}
            className="main-card"
            data-loading={codingImage.loading || !codingImage.url}
          >
            <Link to="/study" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>웹, 앱 개발</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          {/* Study ?? 2 */}
          <LazyBackgroundImage
            src={aiImage.url}
            className="main-card"
            data-loading={aiImage.loading || !aiImage.url}
          >
            <Link to="/study" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>AI</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          {/* Blog ?? 1 */}
          <LazyBackgroundImage
            src={travelImage.url}
            className="main-card"
            data-loading={travelImage.loading || !travelImage.url}
          >
            <Link to="/blog" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>여행</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          {/* Blog ?? 2 */}
          <LazyBackgroundImage
            src={tipImage.url}
            className="main-card"
            data-loading={tipImage.loading || !tipImage.url}
          >
            <Link to="/blog" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>팁</h3>
              </div>
            </Link>
          </LazyBackgroundImage>
        </div>
      </div>
    </div>
  );
}


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
        <Route path="/" element={<Home />} />
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
