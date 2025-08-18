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

import coding from './assets/coding.jpg';
import ai from './assets/ai.jpg';
import travel from './assets/travel.webp';
import tip from './assets/tip.jpg';
import LazyBackgroundImage from './components/LazyBackgroundImage';

// 홈 화면
function Home() {
  return (
    <div>
      <div className='main-section1'>
        <h2>Every Day, A New Page</h2>
      </div>

      <div className='main-section2'>
        <div className='main-section2-title'>Contents</div>

        <div className='main-section2-content'>
          {/* Study 특징 1 */}
          <LazyBackgroundImage src={coding} className="main-card">
            <Link to="/study" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>웹·앱 개발</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          {/* Study 특징 2 */}
          <LazyBackgroundImage src={ai} className="main-card">
            <Link to="/study" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>최신 기술과 AI</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          {/* Blog 특징 1 */}
          <LazyBackgroundImage src={travel} className="main-card">
            <Link to="/blog" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>여행과 일상</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          {/* Blog 특징 2 */}
          <LazyBackgroundImage src={tip} className="main-card">
            <Link to="/blog" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>리뷰와 팁</h3>
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
