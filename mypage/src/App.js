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
          <Link to="/study" className="main-card" style={{ textDecoration: 'none', backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${coding})` }}>
            <div className="main-card-body">
              <h3>웹·앱 개발</h3>
              <p>React, Node.js, Firebase 등 실전 코딩 기술을 체계적으로 학습.</p>
            </div>
          </Link>

          {/* Study 특징 2 */}
          <Link to="/study" className="main-card" style={{ textDecoration: 'none', backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${ai})` }}>
            <div className="main-card-body">
              <h3>최신 기술과 AI</h3>
              <p>인공지능과 최신 개발 트렌드를 깊이 있게 학습.</p>
            </div>
          </Link>

          {/* Blog 특징 1 */}
          <Link to="/blog" className="main-card" style={{ textDecoration: 'none', backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${travel})` }}>
            <div className="main-card-body">
              <h3>여행과 일상</h3>
              <p>여행기, 에세이, 사진·영상으로 담아낸 소소한 이야기들.</p>
            </div>
          </Link>

          {/* Blog 특징 2 */}
          <Link to="/blog" className="main-card" style={{ textDecoration: 'none', backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${tip})` }}>
            <div className="main-card-body">
              <h3>리뷰와 팁</h3>
              <p>제품 리뷰와 튜토리얼로 일상에 도움 투척.</p>
            </div>
          </Link>
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
