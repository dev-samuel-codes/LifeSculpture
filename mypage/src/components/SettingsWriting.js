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

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [category, setCategory] = useState('study');

  const quillRef = useRef(null);

  // 공통 툴바 훅 사용
  const { modules, formats } = useQuillToolbar();

  // 에디터가 준비되면 전역 참조 설정
  useEffect(() => {
    const setupEditor = () => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          console.log('[SettingsWriting] editor ready, setting global reference');
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
          console.warn('[SettingsWriting] editor setup failed after delay');
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, []);

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

    try {
      const docRef = await addDoc(collection(db, category), {
        title: title.trim(),
        content,                // 이미지 URL 포함된 HTML
        createdAt: serverTimestamp(), // 서버 시간
        viewCount: 0,
      });
      console.log('Document written with ID: ', docRef.id);
      alert(`Content submitted successfully to ${category} collection!`);
      setTitle('');
      setContent('');
    } catch (e) {
      console.error('Error adding document: ', e);
      if (e?.code === 'permission-denied') {
        alert('권한이 없습니다. 관리자만 글을 작성할 수 있습니다.');
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

              <div className="mb-3">
                <label htmlFor="contentInput" className="form-label writing-label">Content</label>
                <div className="writing-editor-container">
                  <ReactQuill
                    ref={quillRef}
                    className="writing-quill"
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    formats={formats}
                    style={{ height: '400px' }}
                  />
                </div>
              </div>
            </div>

            <div className="writing-actions">
              <button type="submit" className="btn btn-primary btn-primary-solid">게시하기</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SettingsWriting;

