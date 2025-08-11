// App.js
import './style/App.css';
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Introduce from './components/Introduce';
import Study from './components/Study';
import Blog from './components/Blog';

import AdminDashboard from './components/AdminDashboard';
import Settings from './components/Settings';
import PostDetail from './components/PostDetail';
import EditPost from './components/EditPost';
import { AuthContext } from './context/AuthContext';
import Header from './components/Header';
import './style/Home.css';

// 홈 화면
function Home() {
  return (
    <div>
      <div className='main-section1'>
        <h2>Every Day, A New Page</h2>
        <p>This is the main page content.</p>
      </div>

      <div className='main-section2'>
        <div className='main-section2-title'>Contents</div>

        <div className='main-section2-content'>
          <div className="main-card">
            <div className="main-card-body">
              <h3>Card 1</h3>
              <p>첫 번째 카드</p>
            </div>
          </div>

          <div className="main-card">
            <div className="main-card-body">
              <h3>Card 2</h3>
              <p>두 번째 카드</p>
            </div>
          </div>

          <div className="main-card">
            <div className="main-card-body">
              <h3>Card 3</h3>
              <p>세 번째 카드</p>
            </div>
          </div>

          <div className="main-card">
            <div className="main-card-body">
              <h3>Card 4</h3>
              <p>네 번째 카드</p>
            </div>
          </div>
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
  const { role } = React.useContext(AuthContext);

  return (
    <div className="App">
      <Header />

      <Routes>
        {/* 홈은 컨테이너 없이 전체폭 */}
        <Route path="/" element={<Home />} />

        {/* 나머지 페이지는 컨테이너로 감싸기 */}
        <Route path="/introduce" element={<Page><Introduce /></Page>} />
        <Route path="/study" element={<Page><Study /></Page>} />
        <Route path="/blog" element={<Page><Blog /></Page>} />

        {role === 'admin' && (
          <Route path="/admin" element={<Page><AdminDashboard /></Page>} />
        )}
        {role === 'admin' && (
          <Route path="/settings/*" element={<Page><Settings /></Page>} />
        )}
        <Route path="/posts/:category/:id" element={<Page><PostDetail /></Page>} />
        {role === 'admin' && (
          <Route path="/edit-post/:category/:id" element={<Page><EditPost /></Page>} />
        )}
      </Routes>
    </div>
  );
}

export default App;
