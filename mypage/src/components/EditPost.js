// src/components/EditPost.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { AuthContext } from '../context/AuthContext';
import heic2any from 'heic2any'; // HEIC 변환 라이브러리 추가

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';
import { useQuillToolbar } from './QuillToolbar';
import { registerCustomImageBlot } from './QuillCustomBlots'; // 사용자 정의 블롯 가져오기
import '../style/SettingsWriting.css';
import '../style/QuillToolbar.css';

// 사용자 정의 블롯 등록
registerCustomImageBlot();

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
  const [editorHeight, setEditorHeight] = useState('400px');
  const [contentSize, setContentSize] = useState(0); // content 크기 추적
  const [pendingImages, setPendingImages] = useState([]); // 임시 저장된 이미지들
  const [isUploading, setIsUploading] = useState(false); // 업로드 중 상태

  // 기존 이미지 URL들을 저장할 상태
  const [originalImageUrls, setOriginalImageUrls] = useState([]);

  const quillRef = useRef(null);

  // 공통 툴바 훅 사용
  const { modules, formats, handleImageUpload } = useQuillToolbar();

  // content 크기 계산 함수
  const calculateContentSize = (htmlContent) => {
    // HTML 태그 제거하고 순수 텍스트 길이 계산
    const textContent = htmlContent.replace(/<[^>]*>/g, '');
    return new Blob([textContent]).size;
  };

  // content 변경 시 크기 추적
  const handleContentChange = (newContent) => {
    setContent(newContent);
    const size = calculateContentSize(newContent);
    setContentSize(size);
  };

  // 게시물 내용에서 이미지 URL을 추출하는 함수
  const extractImageUrls = (content) => {
    if (!content) return [];
    
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    const urls = [];
    let match;
    
    while ((match = imgRegex.exec(content)) !== null) {
      const url = match[1];
      
      // Firebase Storage URL 또는 base64 이미지인 경우 모두 포함
      if ((url.startsWith('https://firebasestorage.googleapis.com') && 
           url.includes('/o/') && 
           !url.includes('undefined') && 
           !url.includes('null') &&
           url.length > 50) || 
          url.startsWith('data:image/')) {
        
        // base64 이미지는 바로 추가
        if (url.startsWith('data:image/')) {
          urls.push(url);
        } else {
          // Firebase Storage URL은 유효성 검증 후 추가
          try {
            const urlObj = new URL(url);
            if (urlObj.pathname.includes('/o/')) {
              urls.push(url);
            }
          } catch (e) {
            console.log('[extractImageUrls] 유효하지 않은 URL 무시:', url);
          }
        }
      }
    }
    
    console.log('[extractImageUrls] 추출된 이미지들 (총', urls.length, '개):', urls);
    console.log('[extractImageUrls] Firebase Storage 이미지:', urls.filter(url => url.startsWith('https://firebasestorage.googleapis.com')).length, '개');
    console.log('[extractImageUrls] Base64 이미지:', urls.filter(url => url.startsWith('data:image/')).length, '개');
    return urls;
  };

  // Firebase Storage URL에서 파일 경로를 추출하는 함수
  const extractStoragePath = (imageUrl) => {
    if (!imageUrl.startsWith('https://firebasestorage.googleapis.com')) {
      return null;
    }
    
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      const oIndex = pathParts.findIndex(part => part === 'o');
      
      if (oIndex !== -1 && oIndex + 1 < pathParts.length) {
        let filePath = pathParts.slice(oIndex + 1).join('/');
        
        // 이중 인코딩 문제 해결 (%252F -> %2F -> /)
        if (filePath.includes('%252F')) {
          filePath = filePath.replace(/%252F/g, '/');
        }
        
        // URL 디코딩
        const decodedPath = decodeURIComponent(filePath);
        
        // 파일 경로 유효성 검사
        if (decodedPath && 
            decodedPath !== 'media' && 
            !decodedPath.includes('?') && 
            decodedPath.length > 0 &&
            !decodedPath.includes('undefined') &&
            !decodedPath.includes('null')) {
          return decodedPath;
        }
      }
    } catch (e) {
      console.log('[extractStoragePath] URL 파싱 실패:', e);
    }
    
    return null;
  };

  // 두 이미지 URL이 같은 Firebase Storage 파일을 가리키는지 확인하는 함수
  const isSameStorageImage = (url1, url2) => {
    if (!url1 || !url2) return false;
    
    // 둘 다 Firebase Storage URL인 경우에만 비교
    if (url1.startsWith('https://firebasestorage.googleapis.com') && 
        url2.startsWith('https://firebasestorage.googleapis.com')) {
      
      const path1 = extractStoragePath(url1);
      const path2 = extractStoragePath(url2);
      
      if (path1 && path2) {
        return path1 === path2;
      }
    }
    
    // 정확한 URL 일치
    return url1 === url2;
  };

  // HEIC 파일을 JPEG로 변환하는 함수
  const convertHeicToJpeg = async (file) => {
    if (file.type === 'image/heic' || file.type === 'image/heif' || 
        file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      try {
        console.log('[convertHeicToJpeg] HEIC 파일 변환 시작:', file.name);
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8
        });
        
        // 변환된 Blob을 File 객체로 변환
        const convertedFile = new File([convertedBlob], 
          file.name.replace(/\.(heic|heif)$/i, '.jpg'), 
          { type: 'image/jpeg' }
        );
        
        console.log('[convertHeicToJpeg] HEIC 변환 완료:', {
          원본: file.name,
          변환: convertedFile.name,
          원본크기: `${(file.size / 1024).toFixed(1)}KB`,
          변환크기: `${(convertedFile.size / 1024).toFixed(1)}KB`
        });
        
        return convertedFile;
      } catch (error) {
        console.error('[convertHeicToJpeg] HEIC 변환 실패:', error);
        throw new Error('HEIC 파일 변환에 실패했습니다.');
      }
    }
    return file; // HEIC가 아닌 경우 원본 파일 반환
  };

  // 이미지 핸들러 - 임시 저장용 (SettingsWriting.js와 동일한 방식)
  const handleImageInsert = useCallback(() => {
    console.log('[handleImageInsert] 이미지 삽입 핸들러 시작');
    
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*,.heic,.heif'); // HEIC 형식 추가
    input.setAttribute('capture', 'environment'); // 모바일에서 카메라 접근 허용
    input.click();

    input.onchange = async () => {
      const file = input.files && input.files[0];
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
        // HEIC 파일인 경우 JPEG로 변환
        let processedFile = file;
        if (file.type === 'image/heic' || file.type === 'image/heif' || 
            file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
          console.log('[handleImageInsert] HEIC 파일 감지, 변환 시작');
          processedFile = await convertHeicToJpeg(file);
        }

        // base64 URL 생성
        const reader = new FileReader();
        reader.onload = (e) => {
          const tempUrl = e.target.result;
          
          // 파일을 임시로 저장 (base64 URL 포함)
          const tempImage = {
            id: Date.now() + Math.random(),
            file: processedFile, // 변환된 파일 사용
            originalFile: file, // 원본 파일도 보관 (참조용)
            name: file.name,
            size: file.size,
            type: file.type,
            tempUrl: tempUrl, // base64 URL 저장
            isHeicConverted: processedFile !== file // HEIC 변환 여부 표시
          };

          setPendingImages(prev => [...prev, tempImage]);

          // 에디터에 임시 이미지 삽입
          const editor = quillRef.current?.getEditor();
          if (editor) {
            const range = editor.getSelection(true) || { index: editor.getLength() };
            
            // 현재 선택된 블록의 정렬 상태 확인
            const [line] = editor.getLine(range.index);
            const formats = line ? line.formats() : {};
            const currentAlign = formats.align || '';
            
            // 이미지 삽입
            editor.insertEmbed(range.index, 'image', tempUrl, 'user');
            
            // 정렬이 설정되어 있다면 이미지에도 적용
            if (currentAlign) {
              // 이미지 삽입 후 정렬 적용
              setTimeout(() => {
                const newRange = { index: range.index, length: 1 };
                editor.formatLine(newRange.index, newRange.length, 'align', currentAlign);
                console.log('[handleImageInsert] 이미지 정렬 적용:', currentAlign);
              }, 10);
            }
            
            editor.setSelection(range.index + 1, 0);
            console.log('[handleImageInsert] 임시 이미지 삽입 완료');
          }
        };
        reader.readAsDataURL(processedFile);

      } catch (err) {
        console.error('[handleImageInsert] 이미지 처리 실패:', err);
        if (err.message.includes('HEIC')) {
          alert('HEIC 파일 변환에 실패했습니다. 다른 이미지 형식(PNG, JPEG)을 사용해주세요.');
        } else {
          alert('이미지 처리에 실패했습니다: ' + err.message);
        }
      }
    };
  }, []);

  // 화면 크기에 따른 에디터 높이 조정
  useEffect(() => {
    const updateEditorHeight = () => {
      if (window.innerWidth <= 480) {
        setEditorHeight('300px');
      } else if (window.innerWidth <= 768) {
        setEditorHeight('350px');
      } else {
        setEditorHeight('400px');
      }
    };

    // 초기 설정
    updateEditorHeight();

    // 리사이즈 이벤트 리스너
    window.addEventListener('resize', updateEditorHeight);

    return () => window.removeEventListener('resize', updateEditorHeight);
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
          console.log('[EDIT] 기존 이미지 URL들 로드됨:', existingImages);
          
          // 초기 콘텐츠 크기 계산
          const size = calculateContentSize(data.content || '');
          setContentSize(size);
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

  // Firebase Storage에서 이미지 삭제하는 함수
  const deleteImagesFromStorage = async (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return;
    
    console.log('[deleteImagesFromStorage] Storage 삭제 시작. 총 이미지 수:', imageUrls.length);
    console.log('[deleteImagesFromStorage] 현재 사용자 UID:', uid);
    console.log('[deleteImagesFromStorage] 현재 사용자 역할:', role);
    
    const deletePromises = imageUrls.map(async (imageUrl) => {
      try {
        console.log('[deleteImagesFromStorage] 이미지 URL 처리 중:', imageUrl);
        
        // Firebase Storage URL에서 경로 추출
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
          console.log('[deleteImagesFromStorage] Firebase Storage URL 감지됨');
          
          // 새로운 extractStoragePath 함수 사용
          const decodedPath = extractStoragePath(imageUrl);
          
          if (decodedPath) {
            console.log('[deleteImagesFromStorage] 추출된 파일 경로:', decodedPath);
            
            // 현재 사용자가 해당 이미지를 삭제할 권한이 있는지 확인
            if (decodedPath.includes(uid) || role === 'admin') {
              const imageRef = ref(storage, decodedPath);
              await deleteObject(imageRef);
              console.log('[deleteImagesFromStorage] 기존 이미지 삭제 성공:', decodedPath);
            } else {
              console.log('[deleteImagesFromStorage] 권한이 없어 이미지 삭제를 건너뜀:', decodedPath);
            }
          } else {
            console.log('[deleteImagesFromStorage] 유효하지 않은 파일 경로:', imageUrl);
          }
        } else {
          // base64 이미지나 다른 URL인 경우 (삭제하지 않음)
          if (imageUrl.startsWith('data:')) {
            console.log('[deleteImagesFromStorage] base64 임시 이미지입니다 (삭제 불필요):', imageUrl.substring(0, 50) + '...');
          } else {
            console.log('[deleteImagesFromStorage] Firebase Storage 이미지가 아닙니다 (삭제하지 않음):', imageUrl);
          }
        }
      } catch (error) {
        console.error('[deleteImagesFromStorage] 기존 이미지 삭제 실패:', imageUrl, error);
        console.error('[deleteImagesFromStorage] 에러 코드:', error.code);
        console.error('[deleteImagesFromStorage] 에러 메시지:', error.message);
        
        // 권한 관련 에러인 경우 추가 정보 출력
        if (error.code === 'storage/unauthorized') {
          console.error('[deleteImagesFromStorage] Storage 권한이 없습니다. 현재 UID:', uid);
        }
        
        // 개별 이미지 삭제 실패는 전체 프로세스를 중단하지 않음
      }
    });
    
    const results = await Promise.allSettled(deletePromises);
    console.log('[deleteImagesFromStorage] 삭제 결과:', results);
    
    // 성공/실패 통계
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    console.log(`[deleteImagesFromStorage] 삭제 완료: 성공 ${successful}개, 실패 ${failed}개`);
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
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [handleImageInsert]);

  // 게시하기 시 이미지들을 storage에 업로드 (SettingsWriting.js와 동일한 방식)
  const uploadPendingImages = async () => {
    if (pendingImages.length === 0) return content;

    console.log('[uploadPendingImages] 시작:', pendingImages.length, '개 이미지');
    let updatedContent = content;

    for (const tempImage of pendingImages) {
      try {
        console.log('[uploadPendingImages] 이미지 업로드 중:', tempImage.name);
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

      // 현재 콘텐츠에서 이미지 URL 추출
      const currentImageUrls = extractImageUrls(finalContent);
      console.log('[handleSubmit] 현재 콘텐츠의 모든 이미지들:', currentImageUrls);
      
      // Firebase Storage URL만 필터링하여 비교
      const currentStorageUrls = currentImageUrls.filter(url => 
        url.startsWith('https://firebasestorage.googleapis.com')
      );
      const originalStorageUrls = originalImageUrls.filter(url => 
        url.startsWith('https://firebasestorage.googleapis.com')
      );
      
      // 실제로 제거된 Firebase Storage 이미지들만 찾기 (스타일 변경은 무시)
      const removedImages = originalStorageUrls.filter(originalUrl => {
        // 현재 콘텐츠에 같은 이미지가 있는지 확인 (스타일 변경 고려)
        const stillExists = currentStorageUrls.some(currentUrl => 
          isSameStorageImage(originalUrl, currentUrl)
        );
        
        if (!stillExists) {
          console.log('[handleSubmit] 이미지가 제거됨:', originalUrl);
        } else {
          console.log('[handleSubmit] 이미지가 보존됨 (스타일 변경 포함):', originalUrl);
        }
        
        return !stillExists;
      });
      
      console.log('[handleSubmit] 원본 Firebase Storage 이미지들:', originalStorageUrls);
      console.log('[handleSubmit] 현재 Firebase Storage 이미지들:', currentStorageUrls);
      console.log('[handleSubmit] 제거된 Firebase Storage 이미지들:', removedImages);
      
      // 이미지 삭제가 필요한 경우에만 처리 (사용자가 실제로 이미지를 제거한 경우)
      if (removedImages.length > 0) {
        console.log('[handleSubmit] Storage에서 삭제할 이미지들:', removedImages);
        
        // 삭제 전 추가 검증 - 더 엄격한 검증
        const validRemovedImages = removedImages.filter(url => {
          // Firebase Storage URL이고 유효한 경로를 포함하는지 확인
          const isValidUrl = url.startsWith('https://firebasestorage.googleapis.com') && 
                           url.includes('/o/') && 
                           !url.includes('undefined') && 
                           !url.includes('null') &&
                           url.length > 50;
          
          if (!isValidUrl) {
            console.log('[handleSubmit] 유효하지 않은 URL 제외:', url);
            return false;
          }
          
          // URL 파싱 테스트
          try {
            const urlObj = new URL(url);
            const hasValidPath = urlObj.pathname.includes('/o/');
            if (!hasValidPath) {
              console.log('[handleSubmit] 유효하지 않은 경로 제외:', url);
              return false;
            }
            return true;
          } catch (e) {
            console.log('[handleSubmit] URL 파싱 실패로 제외:', url, e);
            return false;
          }
        });
        
        if (validRemovedImages.length > 0) {
          console.log('[handleSubmit] 유효한 삭제 대상 이미지들:', validRemovedImages);
          
          // 사용자 확인 - 이미지 삭제 전 반드시 확인받음
          const confirmDelete = window.confirm(
            `⚠️ 이미지 삭제 확인 ⚠️\n\n` +
            `정말로 ${validRemovedImages.length}개의 이미지를 삭제하시겠습니까?\n\n` +
            `삭제할 이미지들:\n${validRemovedImages.map(url => `• ${url.split('/').pop()}`).join('\n')}\n\n` +
            `⚠️ 주의사항:\n` +
            `• 이 작업은 되돌릴 수 없습니다\n` +
            `• 이미지가 실제로 제거되었는지 확인하세요\n` +
            `• 실수로 삭제하지 않았는지 다시 한번 확인하세요\n` +
            `• 정렬, 크기 조정 등의 스타일 변경은 이미지 삭제가 아닙니다\n\n` +
            `계속하시겠습니까?`
          );
          
          if (confirmDelete) {
            await deleteImagesFromStorage(validRemovedImages);
            console.log('[handleSubmit] Storage 이미지 삭제 완료');
          } else {
            console.log('[handleSubmit] 사용자가 이미지 삭제를 취소했습니다');
            // 사용자가 취소한 경우에도 게시물은 수정됨 (이미지만 삭제 안됨)
          }
        } else {
          console.log('[handleSubmit] 삭제할 유효한 이미지가 없습니다');
        }
      } else {
        console.log('[handleSubmit] 삭제할 Storage 이미지가 없습니다 - 모든 기존 이미지가 보존됨');
      }
      
      const docRef = doc(db, categoryParam, id);
      await updateDoc(docRef, {
        title: title.trim(),
        content: finalContent, // 업로드된 이미지 URL 포함된 HTML
        category: category.trim(),
      });
      alert('Post updated successfully!');
      
      // 수정 완료 후 창 닫기
      window.close();
      
      // 만약 window.close()가 작동하지 않는 경우 (팝업이 아닌 경우)
      // 이전 페이지로 돌아가서 새로고침
      if (window.opener) {
        // 팝업인 경우 부모 창 새로고침
        window.opener.location.reload();
      } else {
        // 일반 창인 경우 이전 페이지로 이동 후 새로고침
        navigate(`/posts/${category}/${id}`, { 
          replace: true,
          state: { refresh: true }
        });
        // 페이지 강제 새로고침
        window.location.reload();
      }
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
                  style={{ height: editorHeight }}
                />
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
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPost;

