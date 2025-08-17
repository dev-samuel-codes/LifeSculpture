// src/components/EditPost.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
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
  const [pendingImages, setPendingImages] = useState([]); // 임시 저장된 이미지들
  const [isUploading, setIsUploading] = useState(false); // 업로드 중 상태

  // 기존 이미지 URL들을 저장할 상태
  const [originalImageUrls, setOriginalImageUrls] = useState([]);

  const quillRef = useRef(null);

  // 공통 툴바 훅 사용
  const { modules, formats, handleImageUpload } = useQuillToolbar();
  
  // 디버깅을 위한 로그
  console.log('[EditPost] useQuillToolbar 결과:', {
    modules: !!modules,
    formats: !!formats,
    handleImageUpload: typeof handleImageUpload,
    handleImageUploadExists: !!handleImageUpload
  });



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

  // 이미지 압축 함수
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // 원본 이미지 크기
        let { width, height } = img;
        
        // 원본 파일 크기에 따른 압축 목표 설정
        const originalSizeMB = file.size / (1024 * 1024);
        let targetSizeKB;
        
        if (originalSizeMB > 10) {
          targetSizeKB = 100; // 10MB 이상이면 100KB로 압축
        } else if (originalSizeMB > 5) {
          targetSizeKB = 200; // 5MB 이상이면 200KB로 압축
        } else if (originalSizeMB > 2) {
          targetSizeKB = 300; // 2MB 이상이면 300KB로 압축
        } else if (originalSizeMB > 1) {
          targetSizeKB = 400; // 1MB 이상이면 400KB로 압축
        } else {
          targetSizeKB = 600; // 1MB 미만이면 600KB로 압축
        }
        
        console.log(`[COMPRESS] 원본: ${originalSizeMB.toFixed(1)}MB, 목표: ${targetSizeKB}KB`);
        
        // 리사이즈 적용
        let maxDimension = 1920;
        if (originalSizeMB > 5) {
          maxDimension = 1280; // 5MB 이상이면 더 작게
        } else if (originalSizeMB > 2) {
          maxDimension = 1600; // 2MB 이상이면 중간 크기
        }
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
          console.log(`[COMPRESS] 리사이즈: ${width}x${height}`);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);
        
        // 품질 조정으로 압축
        let quality = 0.8;
        
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            const currentSizeKB = blob.size / 1024;
            console.log(`[COMPRESS] 시도: ${currentSizeKB.toFixed(1)}KB (품질: ${quality.toFixed(1)})`);
            
            if (blob.size <= targetSizeKB * 1024 || quality <= 0.05) {
              // 압축된 이미지가 목표 크기 이하이거나 최소 품질에 도달
              console.log(`[COMPRESS] 완료: ${currentSizeKB.toFixed(1)}KB (목표: ${targetSizeKB}KB)`);
              resolve(blob);
            } else {
              // 품질을 낮춤
              quality -= 0.15;
              if (quality < 0.05) quality = 0.05;
              tryCompress();
            }
          }, 'image/jpeg', quality);
        };
        
        tryCompress();
      };
      
      img.src = URL.createObjectURL(file);
    });
  };



  // 이미지 핸들러 - 임시 저장용 (SettingsWriting.js와 동일한 방식)
  const handleImageInsert = useCallback(() => {
    console.log('[handleImageInsert] 이미지 삽입 핸들러 시작');
    console.log('[handleImageInsert] quillRef 상태:', !!quillRef.current);
    
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    
    // 파일 선택 이벤트 리스너 추가
    input.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        console.log('[handleImageInsert] 파일이 선택되지 않음');
        return;
      }

      console.log('[handleImageInsert] 선택된 파일:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      try {
        // 이미지 압축
        console.log('[handleImageInsert] 이미지 압축 시작');
        const compressedFile = await compressImage(file);
        console.log('[handleImageInsert] 이미지 압축 완료:', {
          원본: `${(file.size / 1024).toFixed(1)}KB`,
          압축: `${(compressedFile.size / 1024).toFixed(1)}KB`,
          압축률: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
        });

        // 압축된 파일로 base64 URL 생성
        const reader = new FileReader();
        reader.onload = (e) => {
          const tempUrl = e.target.result;
          
          // 압축된 파일을 임시로 저장 (base64 URL 포함)
          const tempImage = {
            id: Date.now() + Math.random(),
            file: compressedFile, // 압축된 파일 사용
            originalFile: file, // 원본 파일도 보관 (참조용)
            name: file.name,
            originalSize: file.size,
            compressedSize: compressedFile.size,
            type: file.type,
            tempUrl: tempUrl // base64 URL 저장
          };

          console.log('[handleImageInsert] tempImage 생성:', tempImage);
          setPendingImages(prev => {
            const newPendingImages = [...prev, tempImage];
            console.log('[handleImageInsert] pendingImages 업데이트:', newPendingImages);
            return newPendingImages;
          });

          // 에디터에 임시 이미지 삽입
          const editor = quillRef.current?.getEditor();
          if (editor) {
            try {
              const range = editor.getSelection(true) || { index: editor.getLength() };
              editor.insertEmbed(range.index, 'image', tempUrl, 'user');
              editor.setSelection(range.index + 1, 0);
              console.log('[handleImageInsert] 임시 이미지 삽입 완료');
            } catch (editorError) {
              console.error('[handleImageInsert] 에디터에 이미지 삽입 실패:', editorError);
            }
          } else {
            console.warn('[handleImageInsert] 에디터를 찾을 수 없음');
          }
        };
        
        reader.onerror = (error) => {
          console.error('[handleImageInsert] FileReader 에러:', error);
        };
        
        reader.readAsDataURL(compressedFile);

      } catch (err) {
        console.error('[handleImageInsert] 이미지 처리 실패:', err);
        alert('이미지 처리에 실패했습니다: ' + err.message);
      }
    });
    
    // 파일 선택 다이얼로그 열기
    input.click();
    
    // 메모리 정리
    setTimeout(() => {
      input.remove();
    }, 1000);
  }, []);

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
      const url = match[1];
      // base64 이미지는 제외 (Firebase Storage URL만 반환)
      if (!url.startsWith('data:')) {
        urls.push(url);
      }
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
          // base64 이미지나 다른 URL인 경우 (삭제하지 않음)
          if (imageUrl.startsWith('data:')) {
            console.log('base64 임시 이미지입니다 (삭제 불필요):', imageUrl.substring(0, 50) + '...');
          } else {
            console.log('Firebase Storage 이미지가 아닙니다 (삭제하지 않음):', imageUrl);
          }
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
          
          // 임시 이미지 핸들러 연결
          try {
            const toolbar = editor.getModule('toolbar');
            if (toolbar && typeof handleImageInsert === 'function') {
              toolbar.addHandler('image', handleImageInsert);
              console.log('[EditPost] 이미지 핸들러 연결 성공');
            } else {
              console.warn('[EditPost] toolbar 또는 handleImageInsert를 찾을 수 없음');
            }
          } catch (error) {
            console.error('[EditPost] 이미지 핸들러 연결 실패:', error);
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
      }, 500); // 지연 시간을 늘림

      return () => clearTimeout(timer);
    }
  }, [handleImageInsert]); // handleImageInsert 의존성 추가

  // 게시하기 시 이미지들을 storage에 업로드 (SettingsWriting.js와 동일한 방식)
  const uploadPendingImages = async () => {
    if (pendingImages.length === 0) return content;

    console.log('[uploadPendingImages] 시작:', pendingImages.length, '개 이미지');
    let updatedContent = content;

    for (const tempImage of pendingImages) {
      try {
        console.log('[uploadPendingImages] 이미지 업로드 중:', tempImage.name);
        console.log('[uploadPendingImages] 압축 정보:', {
          원본: `${(tempImage.originalSize / 1024).toFixed(1)}KB`,
          압축: `${(tempImage.compressedSize / 1024).toFixed(1)}KB`,
          압축률: `${((1 - tempImage.compressedSize / tempImage.originalSize) * 100).toFixed(1)}%`
        });
        
        const url = await handleImageUpload(tempImage.file);
        
        if (url) {
          // 저장된 임시 URL을 실제 storage URL로 교체
          updatedContent = updatedContent.replace(tempImage.tempUrl, url);
          console.log('[uploadPendingImages] 이미지 URL 교체 완료:', tempImage.name);
        }
      } catch (err) {
        console.error('[uploadPendingImages] 이미지 업로드 실패:', tempImage.name, err);
        throw new Error(`이미지 "${tempImage.name}" 업로드에 실패했습니다: ${err.message}`);
      }
    }

    return updatedContent;
  };

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

    setIsUploading(true);

    try {
      // 임시 이미지들을 storage에 업로드하고 content 업데이트
      let finalContent = content;
      if (pendingImages.length > 0) {
        console.log('[handleSubmit] 임시 이미지 업로드 시작');
        console.log('[handleSubmit] pendingImages 상태:', pendingImages);
        finalContent = await uploadPendingImages();
        console.log('[handleSubmit] 임시 이미지 업로드 완료');
        console.log('[handleSubmit] 최종 content 길이:', finalContent.length);
      } else {
        console.log('[handleSubmit] 업로드할 임시 이미지가 없습니다');
      }

      // 현재 콘텐츠에서 Firebase Storage 이미지 URL만 추출 (base64 제외)
      const currentImageUrls = extractImageUrls(finalContent);
      console.log('[handleSubmit] 현재 Firebase Storage 이미지들:', currentImageUrls);
      
      // 기존에 있던 이미지 중 현재 콘텐츠에 없는 것들 찾기
      const removedImages = originalImageUrls.filter(url => !currentImageUrls.includes(url));
      
      // 제거된 이미지들을 Storage에서 삭제
      if (removedImages.length > 0) {
        console.log('[handleSubmit] Storage에서 삭제할 이미지들:', removedImages);
        await deleteImagesFromStorage(removedImages);
        console.log('[handleSubmit] Storage 이미지 삭제 완료');
      } else {
        console.log('[handleSubmit] 삭제할 Storage 이미지가 없습니다');
      }
      
      const docRef = doc(db, categoryParam, id);
      await updateDoc(docRef, {
        title: title.trim(),
        content: finalContent, // 업로드된 이미지 URL 포함된 HTML
        category: category.trim(),
      });
      alert('Post updated successfully!');
      navigate(`/posts/${category}/${id}`);
    } catch (err) {
      console.error('[EDIT] update error:', err);
      if (err?.message?.includes('longer than 1048487 bytes')) {
        alert('콘텐츠가 너무 깁니다. 이미지를 압축하거나 텍스트를 줄여주세요.');
      } else if (err?.message?.includes('이미지')) {
        alert(err.message);
      } else {
        alert('Error updating post.');
      }
    } finally {
      setIsUploading(false);
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
                   </span>
                 )}
                                 {pendingImages.length > 0 && (
                   <span className="ms-3 text-warning">
                     임시 이미지: {pendingImages.length}개 (수정 시 업로드됨)
                     {pendingImages.some(img => img.originalSize > img.compressedSize) && (
                       <span className="ms-1 text-info">
                         (자동 압축됨)
                       </span>
                     )}
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
               disabled={contentSize > MAX_CONTENT_SIZE || isUploading}
             >
               {isUploading ? '업로드 중...' : '수정하기'}
             </button>
           </div>
        </form>
      </div>
    </div>
  );
}

export default EditPost;

