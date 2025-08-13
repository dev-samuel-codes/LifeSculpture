// PostDetail.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import '../style/PostDetail.css';

function PostDetail() {
  const { category, id } = useParams();
  const navigate = useNavigate();
  const { role } = useContext(AuthContext);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docRef = doc(db, category, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setPost({ id: docSnap.id, ...data });
        } else {
          setError('Post not found.');
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Failed to load post.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [category, id]);

  // 조회수 증가는 별도로 처리 (관리자만)
  useEffect(() => {
    const incrementViewCount = async () => {
      if (role === 'admin' && post) {
        try {
          const docRef = doc(db, category, id);
          await updateDoc(docRef, { viewCount: increment(1) });
          // 로컬 상태 업데이트
          setPost(prev => ({ ...prev, viewCount: (prev.viewCount || 0) + 1 }));
        } catch (err) {
          console.warn('Failed to increment view count:', err);
        }
      }
    };

    incrementViewCount();
  }, [role, post, category, id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await deleteDoc(doc(db, category, id));
      alert('Post deleted successfully!');
      navigate(`/${category}`);
    } catch (e) {
      console.error('Error deleting document: ', e);
      alert('Error deleting post.');
    }
  };

  const handleImageClick = useCallback((imageSrc) => {
    console.log('handleImageClick called with:', imageSrc);
    setSelectedImage(imageSrc);
  }, []);

  const closeImageModal = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // 게시물 내용의 이미지에 클릭 이벤트 추가
  useEffect(() => {
    if (post && post.content) {
      const contentElement = document.querySelector('.post-content');
      if (contentElement) {
        // post-content에 클릭 이벤트 추가
        const handleContentClick = (event) => {
          if (event.target.tagName === 'IMG') {
            console.log('Image clicked:', event.target.src); // 디버깅용
            event.preventDefault();
            event.stopPropagation();
            handleImageClick(event.target.src);
          }
        };
        
        contentElement.addEventListener('click', handleContentClick);
        
        // 이미지 스타일 적용
        const images = contentElement.querySelectorAll('img');
        images.forEach(img => {
          img.style.cursor = 'pointer';
          img.style.maxWidth = '60%';
          img.style.height = 'auto';
          img.style.borderRadius = '8px';
        });
        
        // 클린업 함수
        return () => {
          contentElement.removeEventListener('click', handleContentClick);
        };
      }
    }
  }, [post, handleImageClick]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && selectedImage) {
        closeImageModal();
      }
    };

    if (selectedImage) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [selectedImage, closeImageModal]);

  // 날짜만 표시 (YYYY-MM-DD)
  const formatDateOnly = (value) => {
    if (!value) return '';
    let date;

    // Firestore Timestamp 객체
    if (value.toDate && typeof value.toDate === 'function') {
      date = value.toDate();
    } 
    // JS Date 객체
    else if (value instanceof Date) {
      date = value;
    } 
    // number(ms) 또는 문자열
    else {
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) return '';
      date = parsed;
    }

    // 한국 표준(yyyy. MM. dd.) 대신 고정형식 YYYY-MM-DD 원하시면 아래로 사용
    // return date.toISOString().slice(0, 10);

    // “날짜까지만” + 로캘: ko-KR (예: 2025. 8. 12.)
    // 필요시 위의 ISO 형식 주석 해제해 사용하세요.
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Seoul',
    })
      .format(date)
      .replace(/\.\s?/g, '. ') // 보기 좋게 공백 유지 (원하시면 제거 가능)
      .trim();
  };

  if (loading) return <div className="post-status">Loading post...</div>;
  if (error)   return <div className="post-status">Error: {error}</div>;
  if (!post)   return <div className="post-status">Post not found.</div>;

  const createdAtText = formatDateOnly(post?.createdAt);

  return (
    <article className="post-detail-container">
      <header className="post-header">
        <h2 className="post-title">{post.title}</h2>

        {role === 'admin' && (
          <div className="post-actions">
            <button
              className="btn btn-warning btn-sm"
              onClick={() => navigate(`/edit-post/${category}/${id}`)}
              aria-label="Edit post"
            >
              Edit
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              aria-label="Delete post"
            >
              Delete
            </button>
          </div>
        )}
      </header>

      <div className="post-meta">
        <span>{createdAtText}</span>
        <span>·</span>
        <span>Views: {post.viewCount}</span>
      </div>

      {/* 서버에서 전달된 HTML을 렌더링 (기존 기능 유지) */}
      <section
        className="post-content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {selectedImage && (
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Enlarged" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            <button 
              className="btn btn-light position-absolute top-0 end-0 m-2" 
              onClick={closeImageModal}
              style={{ zIndex: 1001 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default PostDetail;
