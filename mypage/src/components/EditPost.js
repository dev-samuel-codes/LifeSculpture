// src/components/EditPost.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

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

  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

