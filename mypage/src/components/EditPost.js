// src/components/EditPost.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useQuillToolbar, handleImageUpload } from './QuillToolbar';
import '../style/EditPost.css';
import '../style/QuillToolbar.css';

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
  const { modules: baseModules, formats } = useQuillToolbar();

  // 커스텀 이미지 핸들러 (에디터 참조 필요)
  const customImageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        const url = await handleImageUpload(file);
        if (!url) return;

        const editor = quillRef.current?.getEditor?.();
        if (!editor) {
          alert('에디터가 아직 준비되지 않았어요. 새로고침 후 다시 시도해보세요.');
          return;
        }
        const range = editor.getSelection(true) || { index: editor.getLength() };
        editor.insertEmbed(range.index, 'image', url, 'user');
        editor.setSelection(range.index + 1, 0);
      } catch (err) {
        console.error('[HANDLER] failed:', err);
        alert('이미지 삽입에 실패했어요.');
      }
    };
  };

  // 커스텀 테이블 핸들러 (에디터 참조 필요)
  const customTableHandler = () => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      console.error('[QUILL] editor not ready');
      return;
    }

    const range = editor.getSelection(true) || { index: editor.getLength() };
    editor.insertTable(3, 3, range.index);
    editor.setSelection(range.index + 1, 0);
  };

  // 커스텀 핸들러로 모듈 업데이트
  const modules = {
    ...baseModules,
    toolbar: {
      ...baseModules.toolbar,
      handlers: { 
        image: customImageHandler, 
        table: customTableHandler 
      }
    }
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
      <div className="editpost-container">
        <div className="editpost-header">
          <h3>Edit Post</h3>
          <p className="editpost-subtitle">
            카테고리: <strong>{category}</strong> · 문서를 깔끔하게 다듬어 보세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="editpost-form">
          <div className="row mb-3 editpost-row">
            <div className="col-12">
              <label htmlFor="titleInput" className="form-label editpost-label">Title</label>
              <input
                type="text"
                id="titleInput"
                className="form-control editpost-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="contentInput" className="form-label editpost-label">Content</label>
            <div className="editpost-editor" id="contentInput">
              <ReactQuill
                ref={quillRef}
                className="editpost-quill"
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                formats={formats}
                style={{ height: '400px' }}
              />
            </div>
          </div>

          <div className="editpost-actions">
            <button type="submit" className="btn btn-primary btn-primary-solid">수정하기</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPost;
