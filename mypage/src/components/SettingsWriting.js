// src/components/SettingsWriting.js
import React, { useRef, useState, useEffect } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useQuillToolbar } from './QuillToolbar';
import CustomImageBlot from './QuillCustomBlots'; // 사용자 정의 블롯 가져오기
import '../style/SettingsWriting.css';
import '../style/QuillToolbar.css';

// 사용자 정의 블롯 등록
ReactQuill.Quill.register(CustomImageBlot);

// Firestore 제한 상수
const MAX_CONTENT_SIZE = 1000000; // 약 1MB (안전 마진 포함)

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [category, setCategory] = useState('study');
  const [editorHeight, setEditorHeight] = useState('400px');
  const [isPublic, setIsPublic] = useState(true); // 공개/비공개 상태
  const [contentSize, setContentSize] = useState(0); // content 크기 추적
  const [imageCount, setImageCount] = useState(0); // 이미지 개수 추적

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
          
          // 이미지 핸들러 직접 연결 (imageHandler가 준비된 후)
          if (imageHandler) {
            console.log('[SettingsWriting] connecting image handler to editor');
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
          console.warn('[SettingsWriting] editor setup failed after delay');
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
        console.log('[SettingsWriting] connecting image handler after editor ready');
        editor.getModule('toolbar').addHandler('image', imageHandler);
      }
    }
  }, [imageHandler]);

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

    try {
      const docRef = await addDoc(collection(db, category), {
        title: title.trim(),
        content,                // 이미지 URL 포함된 HTML
        createdAt: serverTimestamp(), // 서버 시간
        viewCount: 0,
        isPublic: isPublic,    // 공개/비공개 상태 추가
      });
      console.log('Document written with ID: ', docRef.id);
      alert(`Content submitted successfully to ${category} collection!`);
      setTitle('');
      setContent('');
      setContentSize(0);
      setImageCount(0);
    } catch (e) {
      console.error('Error adding document: ', e);
      if (e?.code === 'permission-denied') {
        alert('권한이 없습니다. 관리자만 글을 작성할 수 있습니다.');
      } else if (e?.message?.includes('longer than 1048487 bytes')) {
        alert('콘텐츠가 너무 깁니다. 이미지를 압축하거나 텍스트를 줄여주세요.');
      } else {
        alert('Error submitting content.');
      }
    }
  };

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
                  disabled={contentSize > MAX_CONTENT_SIZE}
                >
                  게시하기
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

