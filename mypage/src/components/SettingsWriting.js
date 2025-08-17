// src/components/SettingsWriting.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import heic2any from 'heic2any'; // HEIC 변환 라이브러리 추가
import { useQuillToolbar } from './QuillToolbar';
import { registerCustomImageBlot } from './QuillCustomBlots'; // 사용자 정의 블롯 가져오기
import '../style/SettingsWriting.css';
import '../style/QuillToolbar.css';

// 사용자 정의 블롯 등록
registerCustomImageBlot();

// Firestore 제한 상수
const MAX_CONTENT_SIZE = 1000000; // 약 1MB (안전 마진 포함)

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [category, setCategory] = useState('study');
  const [editorHeight, setEditorHeight] = useState('400px');
  const [isPublic, setIsPublic] = useState(true); // 공개/비공개 상태
  const [contentSize, setContentSize] = useState(0); // content 크기 추적
  const [pendingImages, setPendingImages] = useState([]); // 임시 저장된 이미지들
  const [isUploading, setIsUploading] = useState(false); // 업로드 중 상태
  const [shouldRedirect, setShouldRedirect] = useState(false); // 리다이렉트 플래그

  const quillRef = useRef(null);
  const navigate = useNavigate();

  // 공통 툴바 훅 사용
  const quillToolbar = useQuillToolbar();
  const { modules, formats, handleImageUpload } = quillToolbar || {
    modules: {},
    formats: [],
    handleImageUpload: () => {}
  };

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

  // 이미지 핸들러 - 임시 저장용
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

  // 에디터가 준비되면 전역 참조 설정
  useEffect(() => {
    const setupEditor = () => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          console.log('[SettingsWriting] editor ready, setting global reference');
          window.quillEditor = editor;
          
          // 임시 이미지 핸들러 연결
          editor.getModule('toolbar').addHandler('image', handleImageInsert);
          
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
          console.warn('[SettingsWriting] editor setup failed after delay');
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [handleImageInsert]);

  // 게시하기 시 이미지들을 storage에 업로드
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      alert('로그인이 필요합니다. 관리자 계정으로 로그인 후 다시 시도하세요.');
      return;
    }

    if (!category) {
      alert('Please select a category.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }
    // 빈 문단만 있는지 체크
    const cleaned = content.replace(/<p><br><\/p>/g, '').trim();
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
        finalContent = await uploadPendingImages();
        console.log('[handleSubmit] 임시 이미지 업로드 완료');
      }

      const docRef = await addDoc(collection(db, category), {
        title: title.trim(),
        content: finalContent,                // 업로드된 이미지 URL 포함된 HTML
        createdAt: serverTimestamp(), // 서버 시간
        viewCount: 0,
        isPublic: isPublic,    // 공개/비공개 상태 추가
      });
      console.log('Document written with ID: ', docRef.id);
      alert(`Content submitted successfully to ${category} collection!`);
      
      // 폼 초기화
      setTitle('');
      setContent('');
      setContentSize(0);
      setPendingImages([]);
      
      // 성공 시 해당 카테고리로 리다이렉트
      setShouldRedirect(true);
      navigate(`/${category}`);

    } catch (e) {
      console.error('Error adding document: ', e);
      if (e?.code === 'permission-denied') {
        alert('권한이 없습니다. 관리자만 글을 작성할 수 있습니다.');
      } else if (e?.message?.includes('longer than 1048487 bytes')) {
        alert('콘텐츠가 너무 깁니다. 이미지를 압축하거나 텍스트를 줄여주세요.');
      } else if (e?.message?.includes('이미지')) {
        alert(e.message);
      } else {
        alert('Error submitting content.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // 리다이렉트 훅
  useEffect(() => {
    if (shouldRedirect) {
      // 페이지 이동 후 약간의 지연을 두고 새로고침
      const timer = setTimeout(() => {
        window.location.reload();
        setShouldRedirect(false); // 한 번만 리다이렉트하도록 플래그 초기화
      }, 100); // 100ms 지연으로 페이지 이동 완료 보장
      
      return () => clearTimeout(timer);
    }
  }, [shouldRedirect]);

  return (
    <div className="container mt-4 h-100">
      <div className="row settings-row d-flex h-100">
        <SettingsMenu />
        <div className="col-md-9 h-100 flex-grow-1 settings-writing-container">
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

              <div className="row writing-row d-md-none">
                <div className="col-12">
                  <div className="mb-3" style={{ marginTop: '10px' }}>
                    <label htmlFor="publicSelect" className="form-label writing-label">공개 설정</label>
                    <select
                      className="form-select writing-select"
                      id="publicSelect"
                      value={isPublic ? 'public' : 'private'}
                      onChange={(e) => setIsPublic(e.target.value === 'public')}
                    >
                      <option value="public">공개</option>
                      <option value="private">비공개</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="writing-editor-container">
                  {modules && formats ? (
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
                  ) : (
                    <div className="alert alert-warning">
                      에디터를 로드하는 중입니다...
                    </div>
                  )}
                </div>
              </div>

              <div className="writing-actions">
                <div className="public-switch-container d-none d-md-flex">
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={isPublic} 
                      onChange={(e) => setIsPublic(e.target.checked)} 
                    />
                    <span className="slider round"></span>
                  </label>
                  <span className="ms-2">{isPublic ? '공개' : '비공개'}</span>
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-primary-solid"
                  disabled={contentSize > MAX_CONTENT_SIZE || isUploading}
                >
                  {isUploading ? '업로드 중...' : '게시하기'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SettingsWriting;

