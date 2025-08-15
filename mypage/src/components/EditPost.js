// src/components/EditPost.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { AuthContext } from '../context/AuthContext';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';
import { useQuillToolbar } from './QuillToolbar';
import CustomImageBlot from './QuillCustomBlots'; // 사용자 정의 블롯 가져오기
import '../style/SettingsWriting.css';
import '../style/QuillToolbar.css';

// 사용자 정의 블롯 등록
ReactQuill.Quill.register(CustomImageBlot);

// Firestore 제한 상수
const MAX_CONTENT_SIZE = 1000000; // 약 1MB (안전 마진 포함)

function EditPost() {
  const { category: categoryParam, id } = useParams();
  const navigate = useNavigate();
  const { uid, role } = useContext(AuthContext); // AuthContext에서 uid와 role 가져오기

  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contentSize, setContentSize] = useState(0); // content 크기 추적
  const [imageCount, setImageCount] = useState(0); // 이미지 개수 추적

  // 기존 이미지 URL들을 저장할 상태
  const [originalImageUrls, setOriginalImageUrls] = useState([]);

  const quillRef = useRef(null);

  // 공통 툴바 훅 사용
  const { modules, formats, imageHandler } = useQuillToolbar();

  // content 크기 계산 함수
  const calculateContentSize = (htmlContent) => {
    // HTML 태그 제거하고 순수 텍스트 길이 계산
    const textContent = htmlContent.replace(/<[^>]*>/g, '');
    return new Blob([textContent]).size;
  };

  // 이미지 개수 계산 함수
  const countImages = (htmlContent) => {
    const imgMatches = htmlContent.match(/<img[^>]*>/g);
    return imgMatches ? imgMatches.length : 0;
  };

  // content 변경 시 크기와 이미지 개수 추적
  const handleContentChange = (newContent) => {
    setContent(newContent);
    const size = calculateContentSize(newContent);
    const imgCount = countImages(newContent);
    setContentSize(size);
    setImageCount(imgCount);
  };

  // ====== Load existing post ======
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docRef = doc(db, categoryParam, id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          setError('Post not found.');
        } else {
          const data = snap.data();
          setTitle(data.title || '');
          setContent(data.content || '');
          setCategory(data.category || categoryParam);
          
          // 기존 이미지 URL들 추출하여 저장
          const existingImages = extractImageUrls(data.content || '');
          setOriginalImageUrls(existingImages);
          
          // 초기 콘텐츠 크기와 이미지 개수 계산
          const size = calculateContentSize(data.content || '');
          const imgCount = countImages(data.content || '');
          setContentSize(size);
          setImageCount(imgCount);
        }
      } catch (err) {
        console.error('[EDIT] fetch error:', err);
        setError('Failed to load post for editing.');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [categoryParam, id]);

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
                console.log('기존 이미지 삭제 성공:', decodedPath);
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
                  console.log('기존 이미지 삭제 성공 (대체 방법):', decodedPath);
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
        console.error('기존 이미지 삭제 실패:', imageUrl, error);
        console.error('에러 코드:', error.code);
        console.error('에러 메시지:', error.message);
        
        // 권한 관련 에러인 경우 추가 정보 출력
        if (error.code === 'storage/unauthorized') {
          console.error('Storage 권한이 없습니다. 현재 UID:', uid);
          console.error('Storage 규칙에서 허용된 UID: Bvik2Rv5HzatCW91UNjCuro0y8I3');
        }
        
        // 개별 이미지 삭제 실패는 전체 프로세스를 중단하지 않음
      }
    });
    
    const results = await Promise.allSettled(deletePromises);
    console.log('삭제 결과:', results);
    
    // 성공/실패 통계
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    console.log(`삭제 완료: 성공 ${successful}개, 실패 ${failed}개`);
  };

  // 에디터가 준비되면 전역 참조 설정
  useEffect(() => {
    const setupEditor = () => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          console.log('[EditPost] editor ready, setting global reference');
          window.quillEditor = editor;
          
          // 이미지 핸들러 직접 연결 (imageHandler가 준비된 후)
          if (imageHandler) {
            console.log('[EditPost] connecting image handler to editor');
            editor.getModule('toolbar').addHandler('image', imageHandler);
          }
          
          return true;
        }
      }
      return false;
    };

    // 즉시 시도
    if (!setupEditor()) {
      // 지연 후 다시 시도
      const timer = setTimeout(() => {
        if (!setupEditor()) {
          console.warn('[EditPost] editor setup failed after delay');
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [imageHandler]); // imageHandler 의존성 추가

  // imageHandler가 준비되면 에디터에 연결
  useEffect(() => {
    if (quillRef.current && imageHandler) {
      const editor = quillRef.current.getEditor();
      if (editor) {
        console.log('[EditPost] connecting image handler after editor ready');
        editor.getModule('toolbar').addHandler('image', imageHandler);
      }
    }
  }, [imageHandler]);

  // ====== Submit update ======
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }
    // 빈 문단 제거 후 공백 체크
    const cleaned = (content || '').replace(/<p><br><\/p>/g, '').trim();
    if (!cleaned) {
      alert('Please enter content.');
      return;
    }

    // content 크기 체크
    if (contentSize > MAX_CONTENT_SIZE) {
      alert(`콘텐츠가 너무 깁니다. 현재 크기: ${(contentSize / 1024).toFixed(1)}KB, 최대 허용: ${(MAX_CONTENT_SIZE / 1024).toFixed(1)}KB\n\n이미지가 너무 크거나 텍스트가 너무 많습니다. 이미지를 압축하거나 텍스트를 줄여주세요.`);
      return;
    }

    try {
      // 현재 콘텐츠에서 이미지 URL 추출
      const currentImageUrls = extractImageUrls(content);
      
      // 기존에 있던 이미지 중 현재 콘텐츠에 없는 것들 찾기
      const removedImages = originalImageUrls.filter(url => !currentImageUrls.includes(url));
      
      // 제거된 이미지들을 Storage에서 삭제
      if (removedImages.length > 0) {
        console.log('제거된 이미지들:', removedImages);
        await deleteImagesFromStorage(removedImages);
        console.log('제거된 이미지 삭제 완료');
      }
      
      const docRef = doc(db, categoryParam, id);
      await updateDoc(docRef, {
        title: title.trim(),
        content, // 이미지 URL 포함된 HTML
        category: category.trim(),
      });
      alert('Post updated successfully!');
      navigate(`/posts/${category}/${id}`);
    } catch (err) {
      console.error('[EDIT] update error:', err);
      if (err?.message?.includes('longer than 1048487 bytes')) {
        alert('콘텐츠가 너무 깁니다. 이미지를 압축하거나 텍스트를 줄여주세요.');
      } else {
        alert('Error updating post.');
      }
    }
  };

  if (loading) return <div className="container mt-4">Loading post for editing...</div>;
  if (error) return <div className="container mt-4 text-danger">Error: {error}</div>;

  return (
    <div className="container mt-4 h-100">
      <div className="settings-writing-container">
        <div className="writing-header">
        </div>

        <form onSubmit={handleSubmit} className="writing-form">
          <div className="writing-fields-group">
            <div className="row mb-3 writing-row">
              <div className="col-md-9">
                <label htmlFor="titleInput" className="form-label writing-label">Title</label>
                <input
                  type="text"
                  className="form-control writing-input"
                  id="titleInput"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="제목을 입력하세요"
                />
              </div>
              <div className="col-md-3">
                <label htmlFor="categorySelect" className="form-label writing-label">Category</label>
                <select
                  className="form-select writing-select"
                  id="categorySelect"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="study">Study</option>
                  <option value="blog">Blog</option>
                </select>
              </div>
            </div>

          <div className="mb-3">
            <div className="writing-editor-container">
              <ReactQuill
                ref={quillRef}
                className="writing-quill"
                theme="snow"
                value={content}
                onChange={handleContentChange}
                modules={modules}
                formats={formats}
                style={{ 
                  height: window.innerWidth <= 768 ? '350px' : '400px',
                  marginBottom: window.innerWidth <= 480 ? '6rem' : '4rem'
                }}
              />
            </div>
            
            {/* 콘텐츠 정보 표시 */}
            <div className="mt-2">
              <small className="text-muted">
                콘텐츠 크기: {contentSize > 0 ? `${(contentSize / 1024).toFixed(1)}KB` : '0KB'} 
                {contentSize > MAX_CONTENT_SIZE && (
                  <span className="text-danger ms-2">
                    (제한 초과: {MAX_CONTENT_SIZE / 1024}KB)
                  </span>
                )}
                {imageCount > 0 && (
                  <span className="ms-3">
                    이미지: {imageCount}개
                    <span className="text-info ms-1">
                      (1MB 이상은 자동으로 KB 단위로 압축됩니다)
                    </span>
                  </span>
                )}
              </small>
            </div>
          </div>
        </div>

          <div className="writing-actions d-flex justify-content-end">
            <button 
              type="submit" 
              className="btn btn-primary btn-primary-solid"
              disabled={contentSize > MAX_CONTENT_SIZE}
            >
              수정하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPost;

