// PostDetail.js
import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db, storage } from '../firebase/firebase';
import { doc, getDoc, updateDoc, increment, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { AuthContext } from '../context/AuthContext';
import LoginRequiredPopup from './LoginRequiredPopup';
import LazyImage from './LazyImage';
import CommentsSection from './CommentsSection';
import '../style/PostDetail.css';
import '../style/RichText.css';

function PostDetail() {
  const { category, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, uid, isAuthenticated } = useContext(AuthContext); // isAuthenticated 추가

  // 디버깅: 라우팅 파라미터 확인
  console.log('[PostDetail] 라우팅 파라미터:', { category, id });
  console.log('[PostDetail] 현재 위치:', location.pathname);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPublic, setIsPublic] = useState(true); // 게시물 공개 상태
  const [isLiked, setIsLiked] = useState(false); // 공감 상태
  const [likeCount, setLikeCount] = useState(0); // 공감 수
  const [showLoginPopup, setShowLoginPopup] = useState(false); // 로그인 팝업 상태
  const [renderedContent, setRenderedContent] = useState('');
  const viewCountIncremented = useRef(false);

  useEffect(() => {
    const fetchPost = async () => {
      console.log('[PostDetail] 게시물 로딩 시작:', { category, id });
      try {
        const docRef = doc(db, category, id);
        console.log('[PostDetail] Firestore 참조:', docRef);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const postData = { id: docSnap.id, ...data };
          console.log('[PostDetail] 게시물 데이터 로드됨:', postData);
          
          // 조회수 초기값 설정
          if (typeof postData.viewCount !== 'number') {
            postData.viewCount = 0;
          }
          
          // 공감 수 초기값 설정
          if (typeof postData.likeCount !== 'number') {
            postData.likeCount = 0;
          }
          
          // 공감한 사용자 목록 초기값 설정
          if (!postData.likedBy) {
            postData.likedBy = [];
          }
          
          setPost(postData);
          setIsPublic(typeof data.isPublic === 'boolean' ? data.isPublic : true);
          setLikeCount(postData.likeCount || 0);
          
          // 현재 사용자가 공감했는지 확인
          if (isAuthenticated && uid && postData.likedBy && postData.likedBy.includes(uid)) {
            setIsLiked(true);
          }
          
          console.log('[PostDetail] 게시물 로드됨:', postData);
          console.log('[PostDetail] 현재 조회수:', postData.viewCount);
          console.log('[PostDetail] 현재 공감 수:', postData.likeCount);
        } else {
          console.log('[PostDetail] 게시물이 존재하지 않음:', { category, id });
          setError('게시물을 찾을 수 없습니다.');
        }
      } catch (err) {
        console.error('[PostDetail] 게시물 로드 실패:', err);
        setError('게시물을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [category, id, isAuthenticated, uid]);

  // EditPost에서 수정 완료 후 돌아왔을 때 페이지 재로딩
  useEffect(() => {
    if (location.state?.refresh) {
      console.log('[PostDetail] 수정 완료 감지, 페이지 재로딩');
      
      // state 초기화
      navigate(location.pathname, { replace: true, state: {} });
      
      // 페이지 강제 새로고침
      window.location.reload();
    }
  }, [location.state, navigate, location.pathname]);

  // 조회수 증가는 한 번만 처리 (관리자 제외)
  useEffect(() => {
    const incrementViewCount = async (retryCount = 0) => {
      console.log('조회수 증가 useEffect 실행됨:', {
        hasPost: !!post,
        postId: post?.id,
        category,
        role,
        alreadyIncremented: viewCountIncremented.current,
        retryCount
      });

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
          
          // 플래그 설정하여 중복 실행 방지 (업데이트 완료 후)
          viewCountIncremented.current = true;
          
          console.log('조회수가 성공적으로 증가되었습니다:', currentViewCount + 1);
        } catch (err) {
          console.error('조회수 증가 실패:', err);
          console.error('에러 상세:', err.message, err.code);
          
          // 재시도 로직 (최대 3번)
          if (retryCount < 3 && (err.code === 'unavailable' || err.code === 'deadline-exceeded')) {
            console.log(`조회수 증가 재시도 ${retryCount + 1}/3...`);
            setTimeout(() => {
              incrementViewCount(retryCount + 1);
            }, 1000 * (retryCount + 1)); // 지수 백오프
            return;
          }
          
          // 특정 에러 코드에 대한 처리
          if (err.code === 'permission-denied') {
            console.error('권한이 거부되었습니다. 보안 규칙을 확인해주세요.');
          } else if (err.code === 'not-found') {
            console.error('문서를 찾을 수 없습니다.');
          } else if (err.code === 'unavailable') {
            console.error('Firestore 서비스가 일시적으로 사용할 수 없습니다.');
          } else if (err.code === 'deadline-exceeded') {
            console.error('요청 시간이 초과되었습니다.');
          }
          
          // 에러가 발생해도 플래그를 설정하여 무한 재시도 방지
          viewCountIncremented.current = true;
        }
      } else {
        if (role === 'admin') {
          console.log('관리자이므로 조회수 증가하지 않음');
        } else if (viewCountIncremented.current) {
          console.log('이미 조회수가 증가되었음');
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
      // 즉시 실행하도록 변경 (지연 제거)
      incrementViewCount();
    }
  }, [post, category, id, role]); // post를 의존성 배열에 추가하여 ESLint 경고 해결

  const enhanceCodeBlocks = useCallback((html) => {
    if (!html) {
      return '';
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return html;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    const containers = wrapper.querySelectorAll('.ql-code-block-container');

    containers.forEach((container) => {
      if (!container.classList.contains('has-separated-header')) {
        if (!container.querySelector('.code-block-header')) {
          const header = document.createElement('div');
          header.className = 'code-block-header';

          const indicators = document.createElement('div');
          indicators.className = 'code-block-indicators';

          ['red', 'yellow', 'green'].forEach((color) => {
            const indicator = document.createElement('span');
            indicator.className = `code-block-indicator ${color}`;
            indicators.appendChild(indicator);
          });

          header.appendChild(indicators);
          container.insertBefore(header, container.firstChild);
        }

        let body = container.querySelector('.code-block-body');

        if (!body) {
          body = document.createElement('div');
          body.className = 'code-block-body';

          while (container.children.length > 1) {
            body.appendChild(container.children[1]);
          }

          container.appendChild(body);
        }

        const preElements = body.querySelectorAll('pre');

        preElements.forEach((pre) => {
          if (pre.dataset.lineNumbered === 'true') {
            return;
          }

          const textContent = pre.textContent || '';
          const normalized = textContent.replace(/\r\n/g, '\n');
          const lines = normalized.split('\n');

          if (lines.length > 1 && lines[lines.length - 1] === '') {
            lines.pop();
          }

          const codeElement = document.createElement('code');

          lines.forEach((line, index) => {
            const lineSpan = document.createElement('span');

            lineSpan.textContent = line.length === 0 ? '\u00A0' : line;
            const lineNumber = String(index + 1);
            lineSpan.dataset.lineNumber = lineNumber;
            lineSpan.setAttribute('data-line-number', lineNumber);

            codeElement.appendChild(lineSpan);
          });

          if (lines.length === 0) {
            const placeholderLine = document.createElement('span');
            placeholderLine.textContent = '\u00A0';
            placeholderLine.dataset.lineNumber = '1';
            placeholderLine.setAttribute('data-line-number', '1');
            codeElement.appendChild(placeholderLine);
          }

          pre.innerHTML = '';
          pre.appendChild(codeElement);
          pre.dataset.lineNumbered = 'true';
        });

        container.classList.add('has-separated-header');
      }
    });

    return wrapper.innerHTML;
  }, []);

  useEffect(() => {
    if (post?.content) {
      const enhanced = enhanceCodeBlocks(post.content);
      setRenderedContent(enhanced);
    } else {
      setRenderedContent('');
    }
  }, [post?.content, enhanceCodeBlocks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const contentEl = document.querySelector('.post-content');
      if (!contentEl) return;

      const codeBlocks = contentEl.querySelectorAll('pre'); // Target ALL <pre> tags
      
      codeBlocks.forEach(block => {
          block.style.setProperty('white-space', 'pre', 'important');
          block.style.setProperty('overflow-x', 'auto', 'important');
          block.style.setProperty('max-width', '800px', 'important');
          block.style.setProperty('margin', '1.75rem auto', 'important');
          block.style.setProperty('padding', '1.5rem', 'important');
          block.style.setProperty('background-color', '#1a1f2a', 'important');
          block.style.setProperty('border-radius', '14px', 'important');
          block.style.setProperty('color', '#cfd2d1', 'important');

          // If it's inside a container, remove the container's background and padding
          const container = block.closest('.ql-code-block-container');
          if (container) {
              container.style.setProperty('background-color', 'transparent', 'important');
              container.style.setProperty('padding', '0', 'important');
              container.style.setProperty('border', 'none', 'important');
          }
      });
    }, 100); // 100ms delay

    return () => clearTimeout(timer); // Cleanup
  }, [renderedContent]);

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

  // 로그인 팝업 닫기
  const closeLoginPopup = () => {
    setShowLoginPopup(false);
  };

  // 공감 버튼 클릭 핸들러
  const handleLikeClick = async () => {
    if (!isAuthenticated) {
      setShowLoginPopup(true);
      return;
    }

    try {
      const docRef = doc(db, category, id);
      const newLikeCount = isLiked ? likeCount - 1 : likeCount + 1;
      
      // Firestore 업데이트
      if (isLiked) {
        // 공감 취소
        await updateDoc(docRef, {
          likeCount: increment(-1),
          likedBy: arrayRemove(uid)
        });
      } else {
        // 공감 추가
        await updateDoc(docRef, {
          likeCount: increment(1),
          likedBy: arrayUnion(uid)
        });
      }
      
      // 로컬 상태 업데이트
      setIsLiked(!isLiked);
      setLikeCount(newLikeCount);
      
      console.log('공감 상태 업데이트 성공:', !isLiked ? '추가' : '취소');
    } catch (err) {
      console.error('공감 상태 업데이트 실패:', err);
      alert('공감 상태를 업데이트하는 중 오류가 발생했습니다.');
    }
  };

  // 게시물 내용에서 이미지 URL을 추출하는 함수
  const extractImageUrls = (content) => {
    if (!content) return [];
    
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    const urls = [];
    let match;
    
    while ((match = imgRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
    
    return urls;
  };

  // Firebase Storage에서 이미지 삭제하는 함수
  const deleteImagesFromStorage = async (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return;
    
    console.log('Storage 삭제 시작. 총 이미지 수:', imageUrls.length);
    console.log('현재 사용자 UID:', uid);
    console.log('현재 사용자 역할:', role);
    
    const deletePromises = imageUrls.map(async (imageUrl) => {
      try {
        console.log('이미지 URL 처리 중:', imageUrl);
        
        // Firebase Storage URL에서 경로 추출
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
          console.log('Firebase Storage URL 감지됨');
          
          // URL 객체 생성하여 파싱
          try {
            const url = new URL(imageUrl);
            console.log('파싱된 URL:', url);
            console.log('URL 경로:', url.pathname);
            
            // pathname에서 /o/ 이후의 경로 추출
            const pathParts = url.pathname.split('/');
            const oIndex = pathParts.findIndex(part => part === 'o');
            
            if (oIndex !== -1 && oIndex + 1 < pathParts.length) {
              // /o/ 이후의 경로를 모두 결합
              let filePath = pathParts.slice(oIndex + 1).join('/');
              console.log('추출된 파일 경로 (인코딩됨):', filePath);
              
              // 이중 인코딩 문제 해결 (%252F -> %2F -> /)
              if (filePath.includes('%252F')) {
                filePath = filePath.replace(/%252F/g, '/');
                console.log('이중 인코딩 해결 후:', filePath);
              }
              
              // URL 디코딩
              const decodedPath = decodeURIComponent(filePath);
              console.log('최종 디코딩된 파일 경로:', decodedPath);
              
              if (decodedPath && decodedPath !== 'media' && !decodedPath.includes('?')) {
                const imageRef = ref(storage, decodedPath);
                await deleteObject(imageRef);
                console.log('이미지 삭제 성공:', decodedPath);
              } else {
                console.log('유효하지 않은 파일 경로:', decodedPath);
              }
            } else {
              console.log('o 파라미터를 찾을 수 없음');
            }
          } catch (urlError) {
            console.log('URL 파싱 실패:', urlError);
            
            // 대체 방법: 문자열 파싱 (권한 에러 방지)
            try {
              const urlParts = imageUrl.split('/');
              const pathIndex = urlParts.findIndex(part => part === 'o');
              if (pathIndex !== -1 && pathIndex + 1 < urlParts.length) {
                let encodedPath = urlParts[pathIndex + 1];
                
                // 쿼리 파라미터 제거 (?alt=media&token=...)
                if (encodedPath.includes('?')) {
                  encodedPath = encodedPath.split('?')[0];
                }
                
                // HTML 엔티티 디코딩 (&amp; -> &)
                encodedPath = encodedPath.replace(/&amp;/g, '&');
                
                // 이중 인코딩 문제 해결 (%252F -> %2F -> /)
                if (encodedPath.includes('%252F')) {
                  encodedPath = encodedPath.replace(/%252F/g, '/');
                  console.log('이중 인코딩 해결 후 (대체 방법):', encodedPath);
                }
                
                const decodedPath = decodeURIComponent(encodedPath);
                console.log('대체 방법으로 파싱된 경로:', decodedPath);
                
                if (decodedPath && decodedPath !== 'media' && !decodedPath.includes('?')) {
                  const imageRef = ref(storage, decodedPath);
                  await deleteObject(imageRef);
                  console.log('이미지 삭제 성공 (대체 방법):', decodedPath);
                } else {
                  console.log('유효하지 않은 파일 경로 (대체 방법):', decodedPath);
                }
              }
            } catch (fallbackError) {
              console.log('대체 방법도 실패:', fallbackError);
            }
          }
        } else {
          // 로컬 이미지나 다른 URL인 경우 (삭제하지 않음)
          console.log('Firebase Storage 이미지가 아닙니다:', imageUrl);
        }
      } catch (error) {
        console.error('이미지 삭제 실패:', imageUrl, error);
        console.error('에러 코드:', error.code);
        console.error('에러 메시지:', error.message);
        
        // 권한 관련 에러인 경우 추가 정보 출력
        if (error.code === 'storage/unauthorized') {
          console.error('Storage 권한이 없습니다. 현재 UID:', uid);
        }
        
        // 개별 이미지 삭제 실패는 전체 삭제 프로세스를 중단하지 않음
      }
    });
    
    const results = await Promise.allSettled(deletePromises);
    console.log('삭제 결과:', results);
    
    // 성공/실패 통계
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    console.log(`삭제 완료: 성공 ${successful}개, 실패 ${failed}개`);
  };

  const handleDelete = async () => {
    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?\n게시물에 포함된 이미지도 함께 삭제됩니다.')) return;

    try {
      // 게시물 내용에서 이미지 URL 추출
      const imageUrls = extractImageUrls(post.content);
      console.log('삭제할 이미지들:', imageUrls);
      
      // Firestore에서 게시물 삭제
      await deleteDoc(doc(db, category, id));
      console.log('게시물 삭제 성공');
      
      // 이미지들을 Storage에서 삭제
      if (imageUrls.length > 0) {
        await deleteImagesFromStorage(imageUrls);
        console.log('이미지 삭제 완료');
      }
      
      alert('게시물과 관련 이미지가 성공적으로 삭제되었습니다.');
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

  // 게시물 내용의 이미지에 클릭 이벤트 추가
  useEffect(() => {
    if (post && post.content) {
      const contentElement = document.querySelector('.post-content');
      if (contentElement) {
        // post-content에 클릭 이벤트 추가 (이미지 클릭 시 모달 열기)
        const handleContentClick = (event) => {
          if (event.target.tagName === 'IMG') {
            handleImageClick(event.target.src);
          }
        };
        
        contentElement.addEventListener('click', handleContentClick);

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

  // 모바일 환경에서 화면 크기 변경 시 글자 간격 문제 방지
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 640 && post && post.content) {
        const contentElement = document.querySelector('.post-content');
        if (contentElement) {
          // 모바일에서 글자 간격만 조정하고 정렬은 유지
          const paragraphs = contentElement.querySelectorAll('p');
          paragraphs.forEach(p => {
            // justify 정렬인 경우에만 left로 변경
            if (p.classList.contains('ql-align-justify')) {
              p.style.textAlign = 'left';
            }
            // 글자 간격 문제 해결
            p.style.wordSpacing = 'normal';
            p.style.letterSpacing = 'normal';
          });
          
          // justify 정렬 클래스가 적용된 요소들만 left 정렬로 변경
          const justifyElements = contentElement.querySelectorAll('.ql-align-justify');
          justifyElements.forEach(element => {
            element.style.textAlign = 'left';
            element.style.wordSpacing = 'normal';
            element.style.letterSpacing = 'normal';
          });
        }
      }
    };

    // 초기 실행
    handleResize();
    
    // 리사이즈 이벤트 리스너 추가
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [post]);

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
        <div className="title-actions-container">
          <div className="left-section">
            <h2 className="post-title">{post.title}</h2>
          </div>
          
          {role !== 'admin' && (
            <div className="like-section">
              <button
                className={`heart-button ${isLiked ? 'liked' : ''}`}
                onClick={handleLikeClick}
                title={isAuthenticated ? (isLiked ? '공감 취소' : '공감하기') : '로그인이 필요합니다'}
                aria-label={isAuthenticated ? (isLiked ? '공감 취소' : '공감하기') : '로그인이 필요합니다'}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </button>
              <span className="like-count">{likeCount}</span>
            </div>
          )}

          {role === 'admin' && (
            <div className="admin-actions">
              <div className="public-switch-container">
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={isPublic} 
                    onChange={handlePublicToggle} 
                  />
                  <span className="slider round"></span>
                </label>
                <span className="public-status">{isPublic ? '공개' : '비공개'}</span>
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
        </div>
      </header>

      <div className="post-meta">
        <div className="meta-left">
          <span>{createdAtText}</span>
          <span>·</span>
          <span>Views: {post.viewCount || 0}</span>
          {role === 'admin' && (
            <>
              <span>·</span>
              <span>공감: {likeCount}</span>
            </>
          )}
        </div>
        
        {role !== 'admin' && (
          <div className="meta-right">
            <div className="like-section">
              <button
                className={`heart-button ${isLiked ? 'liked' : ''}`}
                onClick={handleLikeClick}
                title={isAuthenticated ? (isLiked ? '공감 취소' : '공감하기') : '로그인이 필요합니다'}
                aria-label={isAuthenticated ? (isLiked ? '공감 취소' : '공감하기') : '로그인이 필요합니다'}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </button>
              <span className="like-count">{likeCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* 서버에서 전달된 HTML을 렌더링 (고급 스타일링 적용) */}
      <section
        className="post-content rich-text"
        dangerouslySetInnerHTML={{ __html: renderedContent || post.content }}
      />

      {selectedImage && (
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <LazyImage
              src={selectedImage}
              alt="Enlarged"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
                                                <button
              className="btn btn-light position-absolute top-0 end-0 m-2"
              onClick={closeImageModal}
              style={{ zIndex: 1001 }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <CommentsSection category={category} postId={id} />
      {/* Login required popup for post likes */}
      <LoginRequiredPopup
        isOpen={showLoginPopup}
        onClose={closeLoginPopup}
        message="공감 기능을 사용하려면 로그인이 필요합니다."
      />
    </article>
  );
}

export default PostDetail;
