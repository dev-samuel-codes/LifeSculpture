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


function EditPost() {
  const { category, id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const quillRef = useRef(null);

  // ====== Load existing post ======
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docRef = doc(db, category, id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          setError('Post not found.');
        } else {
          const data = snap.data();
          setTitle(data.title || '');
          setContent(data.content || '');
        }
      } catch (err) {
        console.error('[EDIT] fetch error:', err);
        setError('Failed to load post for editing.');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [category, id]);

  // 공통 툴바 훅 사용
  const { modules, formats } = useQuillToolbar();

  // 에디터가 준비되면 전역 참조 설정
  useEffect(() => {
    const setupEditor = () => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          console.log('[EditPost] editor ready, setting global reference');
          window.quillEditor = editor;
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
  }, []);

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

    try {
      const docRef = doc(db, category, id);
      await updateDoc(docRef, {
        title: title.trim(),
        content, // HTML
      });
      alert('Post updated successfully!');
      navigate(`/posts/${category}/${id}`);
    } catch (err) {
      console.error('[EDIT] update error:', err);
      alert('Error updating post.');
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
          <div className="row mb-3 writing-row">
            <div className="col-12">
              <label htmlFor="titleInput" className="form-label writing-label">Title</label>
              <input
                type="text"
                id="titleInput"
                className="form-control writing-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="contentInput" className="form-label writing-label">Content</label>
            <div className="writing-editor-container" id="contentInput">
              <ReactQuill
                ref={quillRef}
                className="writing-quill"
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                formats={formats}
                style={{ 
                  height: window.innerWidth <= 768 ? '350px' : '400px',
                  marginBottom: window.innerWidth <= 480 ? '6rem' : '4rem'
                }}
              />
            </div>
          </div>

          <div className="writing-actions d-flex justify-content-end">
            <button type="submit" className="btn btn-primary btn-primary-solid">수정하기</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPost;

