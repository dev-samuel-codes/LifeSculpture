import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import '../../style/Home.css';

function Home() {
  const [latestStudyPost, setLatestStudyPost] = useState(null);
  const [latestBlogPost, setLatestBlogPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLatestPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch latest Study post
        const studyQuery = query(
          collection(db, "study"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const studySnapshot = await getDocs(studyQuery);
        if (!studySnapshot.empty) {
          setLatestStudyPost({
            id: studySnapshot.docs[0].id,
            ...studySnapshot.docs[0].data(),
          });
        }

        // Fetch latest Blog post
        const blogQuery = query(
          collection(db, "blog"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const blogSnapshot = await getDocs(blogQuery);
        if (!blogSnapshot.empty) {
          setLatestBlogPost({
            id: blogSnapshot.docs[0].id,
            ...blogSnapshot.docs[0].data(),
          });
        }
      } catch (err) {
        console.error("Error fetching latest posts:", err);
        setError("최신 게시물을 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchLatestPosts();
  }, []);

  if (loading) {
    return (
      <div>
        <div className='main-section1'>
          <h2>Every Day, A New Page</h2>
        </div>
        <div className='main-section2'>
          <div className='main-section2-title'>Contents</div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className='main-section1'>
          <h2>Every Day, A New Page</h2>
        </div>
        <div className='main-section2'>
          <div className='main-section2-title'>Contents</div>
          <p className="text-danger">오류: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className='main-section1'>
        <h2>Every Day, A New Page</h2>
      </div>

      <div className='main-section2'>
        <div className='main-section2-title'>Contents</div>

        <div className='main-section2-content'>
          {/* Introduce Card */}
          <div className="main-card">
            <div className="main-card-body">
              <h3>환영합니다!</h3>
              <p>저의 개인 페이지에 오신 것을 환영합니다. 저에 대한 소개와 다양한 관심사를 탐색해보세요.</p>
            </div>
          </div>

          {/* Study Card */}
          <div className="main-card">
            <div className="main-card-body">
              <h3>배움의 여정</h3>
              {latestStudyPost ? (
                <Link to={`/posts/study/${latestStudyPost.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h4>{latestStudyPost.title}</h4>
                  <p>{latestStudyPost.content.substring(0, 100)}...</p>
                </Link>
              ) : (
                <p>아직 스터디 게시물이 없습니다.</p>
              )}
            </div>
          </div>

          {/* Blog Card */}
          <div className="main-card">
            <div className="main-card-body">
              <h3>생각 나누기</h3>
              {latestBlogPost ? (
                <Link to={`/posts/blog/${latestBlogPost.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h4>{latestBlogPost.title}</h4>
                  <p>{latestBlogPost.content.substring(0, 100)}...</p>
                </Link>
              ) : (
                <p>아직 블로그 게시물이 없습니다.</p>
              )}
            </div>
          </div>

          {/* Connect Card */}
          <div className="main-card">
            <div className="main-card-body">
              <h3>소통해요</h3>
              <p>궁금한 점이나 협업 문의는 언제든지 환영합니다. 저에게 연락주세요!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
