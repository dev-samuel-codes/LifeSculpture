// src/components/EditPost.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';
import { useQuillToolbar, handleImageUpload } from './QuillToolbar';
import ImageBlot from './QuillCustomBlots'; // 사용자 정의 블롯 가져오기
import '../style/EditPost.css';
import '../style/QuillToolbar.css';

// 사용자 정의 블롯 등록
ReactQuill.Quill.register(ImageBlot);


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

  // 커스텀 이모지 핸들러
  const customEmojiHandler = () => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      console.error('[QUILL] editor not ready');
      return;
    }

    const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💌', '💘', '💝', '💖', '💗', '💙', '💚', '🧡', '💛', '💜', '🖤', '💟', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💔'];
    const emoji = prompt('이모지를 입력하거나 선택하세요:', emojis.slice(0, 20).join(' '));
    if (emoji) {
      const range = editor.getSelection(true) || { index: editor.getLength() };
      editor.insertText(range.index, emoji, 'user');
      editor.setSelection(range.index + emoji.length, 0);
    }
  };

  // 커스텀 핸들러로 모듈 업데이트
  const modules = {
    ...baseModules,
    toolbar: [
      // 1행: 제목 스타일, 폰트, 크기
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', '맑은 고딕', '나눔고딕', '나눔바른고딕'] }],
      [{ 'size': ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72'] }],
      
      // 2행: 텍스트 스타일
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'script': 'sub' }, { 'script': 'super' }],
      
      // 3행: 문단 스타일
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }, { 'align': ['', 'left', 'center', 'right', 'justify'] }],
      
      // 4행: 미디어 및 고급 기능
      ['link', 'image', 'video', 'table'],
      ['emoji'],
      
      // 5행: 특수 기능
      ['clean', 'undo', 'redo'],
    ],
    handlers: { 
      image: customImageHandler, 
      table: customTableHandler,
      emoji: customEmojiHandler,
      'align': function(value) {
        const range = this.quill.getSelection();
        if (range) {
          this.quill.formatLine(range.index, range.length, 'align', value);
        }
      }
    }
  };

  // 에디터가 준비되면 전역 참조 설정
  useEffect(() => {
    const timer = setTimeout(() => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          window.quillEditor = editor;
        }
      }
    }, 100); // 100ms 지연으로 에디터 초기화 완료 대기

    return () => clearTimeout(timer);
  }, []); // 빈 의존성 배열로 수정

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
