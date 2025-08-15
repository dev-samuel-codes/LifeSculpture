// PostDetail.js
import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
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
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPublic, setIsPublic] = useState(true); // 게시물 공개 상태
  const viewCountIncremented = useRef(false);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docRef = doc(db, category, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const postData = { id: docSnap.id, ...data };
          
          // 조회수 초기값 설정
          if (typeof postData.viewCount !== 'number') {
            postData.viewCount = 0;
          }
          
          setPost(postData);
          setIsPublic(typeof data.isPublic === 'boolean' ? data.isPublic : true);
          
          console.log('게시물 로드됨:', postData);
          console.log('현재 조회수:', postData.viewCount);
        } else {
          setError('게시물을 찾을 수 없습니다.');
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('게시물을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [category, id]);

  // 조회수 증가는 한 번만 처리 (관리자 제외)
  useEffect(() => {
    const incrementViewCount = async () => {
      // post가 로드되었고, 관리자가 아니며, 아직 조회수가 증가되지 않았을 때만 실행
      if (post && post.id && role !== 'admin' && !viewCountIncremented.current) {
        try {
          console.log('조회수 증가 시도...');
          console.log('현재 게시물:', post);
          
          const docRef = doc(db, category, id);
          
          // 현재 조회수 확인
          const currentViewCount = post.viewCount || 0;
          console.log('현재 조회수:', currentViewCount);
          
          // Firestore 업데이트
          await updateDoc(docRef, { 
            viewCount: increment(1) 
          });
          
          console.log('Firestore 업데이트 성공');
          
          // 로컬 상태 업데이트
          setPost(prev => {
            const newViewCount = (prev.viewCount || 0) + 1;
            console.log('로컬 상태 업데이트:', newViewCount);
            return { 
              ...prev, 
              viewCount: newViewCount
            };
          });
          
          // 플래그 설정하여 중복 실행 방지
          viewCountIncremented.current = true;
          
          console.log('조회수가 성공적으로 증가되었습니다:', currentViewCount + 1);
        } catch (err) {
          console.error('조회수 증가 실패:', err);
          console.error('에러 상세:', err.message, err.code);
          
          // 특정 에러 코드에 대한 처리
          if (err.code === 'permission-denied') {
            console.error('권한이 거부되었습니다. 보안 규칙을 확인해주세요.');
          } else if (err.code === 'not-found') {
            console.error('문서를 찾을 수 없습니다.');
          }
          
          // 에러가 발생해도 플래그를 설정하여 무한 재시도 방지
          viewCountIncremented.current = true;
        }
      } else {
        if (role === 'admin') {
          console.log('관리자이므로 조회수 증가하지 않음');
        } else {
          console.log('조회수 증가 조건 미충족:', {
            hasPost: !!post,
            hasId: post?.id,
            alreadyIncremented: viewCountIncremented.current
          });
        }
      }
    };

    // post가 완전히 로드된 후에만 실행
    if (post && post.id) {
      // 약간의 지연을 두어 안정성 향상
      const timer = setTimeout(() => {
        incrementViewCount();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [post, category, id, role]); // role도 의존성에 추가

  const handlePublicToggle = async () => {
    const newPublicState = !isPublic;
    setIsPublic(newPublicState); // UI 즉시 업데이트

    try {
      const docRef = doc(db, category, id);
      await updateDoc(docRef, { isPublic: newPublicState });
    } catch (err) {
      console.error('Error updating post status:', err);
      setIsPublic(!newPublicState); // 에러 시 UI 롤백
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, category, id));
      alert('게시물이 성공적으로 삭제되었습니다.');
      navigate(`/${category}`);
    } catch (e) {
      console.error('Error deleting document: ', e);
      alert('게시물을 삭제하는 중 오류가 발생했습니다.');
    }
  };

  const handleImageClick = useCallback((imageSrc) => {
    console.log('handleImageClick called with:', imageSrc);
    setSelectedImage(imageSrc);
  }, []);

  const closeImageModal = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // 게시물 내용의 이미지에 클릭 이벤트 추가 및 고급 스타일링
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
          img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          img.style.transition = 'transform 0.2s ease';
          
          // 호버 효과 추가
          img.addEventListener('mouseenter', () => {
            img.style.transform = 'scale(1.02)';
          });
          img.addEventListener('mouseleave', () => {
            img.style.transform = 'scale(1)';
          });
        });

        // 테이블 스타일링
        const tables = contentElement.querySelectorAll('table');
        tables.forEach(table => {
          table.style.width = '100%';
          table.style.borderCollapse = 'collapse';
          table.style.margin = '1rem 0';
          table.style.border = '1px solid #ddd';
          
          // 테이블 셀 스타일링
          const cells = table.querySelectorAll('td, th');
          cells.forEach(cell => {
            cell.style.padding = '8px 12px';
            cell.style.border = '1px solid #ddd';
            cell.style.textAlign = 'left';
          });
          
          // 테이블 헤더 스타일링
          const headers = table.querySelectorAll('th');
          headers.forEach(header => {
            header.style.backgroundColor = '#f8f9fa';
            header.style.fontWeight = 'bold';
          });
        });

        // 코드 블록 스타일링
        const codeBlocks = contentElement.querySelectorAll('pre, code');
        codeBlocks.forEach(code => {
          if (code.tagName === 'PRE') {
            code.style.backgroundColor = '#f8f9fa';
            code.style.border = '1px solid #e9ecef';
            code.style.borderRadius = '4px';
            code.style.padding = '1rem';
            code.style.overflowX = 'auto';
            code.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
            code.style.fontSize = '14px';
            code.style.lineHeight = '1.5';
          } else {
            code.style.backgroundColor = '#f8f9fa';
            code.style.padding = '2px 4px';
            code.style.borderRadius = '3px';
            code.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
            code.style.fontSize = '0.9em';
          }
        });

        // 인용구 스타일링
        const blockquotes = contentElement.querySelectorAll('blockquote');
        blockquotes.forEach(quote => {
          quote.style.borderLeft = '4px solid #007bff';
          quote.style.paddingLeft = '1rem';
          quote.style.margin = '1rem 0';
          quote.style.fontStyle = 'italic';
          quote.style.color = '#6c757d';
          quote.style.backgroundColor = '#f8f9fa';
          quote.style.padding = '1rem';
          quote.style.borderRadius = '4px';
        });



        // 리스트 스타일링
        const lists = contentElement.querySelectorAll('ul, ol');
        lists.forEach(list => {
          list.style.paddingLeft = '2rem';
          list.style.margin = '1rem 0';
        });

        // 링크 스타일링
        const links = contentElement.querySelectorAll('a');
        links.forEach(link => {
          link.style.color = '#007bff';
          link.style.textDecoration = 'none';
          link.style.borderBottom = '1px solid transparent';
          link.style.transition = 'border-bottom-color 0.2s ease';
          
          link.addEventListener('mouseenter', () => {
            link.style.borderBottomColor = '#007bff';
          });
          link.addEventListener('mouseleave', () => {
            link.style.borderBottomColor = 'transparent';
          });
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

    // "날짜까지만" + 로캘: ko-KR (예: 2025. 8. 12.)
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

  if (loading) return <div className="post-status">게시물을 불러오는 중...</div>;
  if (error)   return <div className="post-status">오류: {error}</div>;
  if (!post)   return <div className="post-status">게시물을 찾을 수 없습니다.</div>;

  if (post.isPublic === false && role !== 'admin') {
    return <div className="post-status">비공개 게시물입니다.</div>;
  }

  const createdAtText = formatDateOnly(post?.createdAt);

  return (
    <article className="post-detail-container">
      <header className="post-header">
        <h2 className="post-title">{post.title}</h2>

        {role === 'admin' && (
          <div className="post-actions">
            <div className="public-switch-container">
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={isPublic} 
                  onChange={handlePublicToggle} 
                />
                <span className="slider round"></span>
              </label>
              <span>{isPublic ? '공개' : '비공개'}</span>
            </div>
            <div className="edit-delete-buttons">
              <button
                className="btn btn-warning btn-sm"
                onClick={() => window.open(`/edit-post/${category}/${id}`, '_blank')}
                aria-label="Edit post"
              >
                수정
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                aria-label="Delete post"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="post-meta">
        <span>{createdAtText}</span>
        <span>·</span>
        <span>Views: {post.viewCount || 0}</span>
      </div>

      {/* 서버에서 전달된 HTML을 렌더링 (고급 스타일링 적용) */}
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
