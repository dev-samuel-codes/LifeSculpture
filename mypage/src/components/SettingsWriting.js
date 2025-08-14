// src/components/SettingsWriting.js
import React, { useRef, useState, useEffect } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useQuillToolbar, handleImageUpload } from './QuillToolbar';
import ImageBlot from './QuillCustomBlots'; // 사용자 정의 블롯 가져오기
import '../style/SettingsWriting.css';
import '../style/QuillToolbar.css';

// 사용자 정의 블롯 등록
ReactQuill.Quill.register(ImageBlot);

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [category, setCategory] = useState('study');

  const quillRef = useRef(null);

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
          console.error('[QUILL] editor not ready');
          alert('에디터가 아직 준비되지 않았어요. 페이지를 새로고침 후 다시 시도해보세요.');
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
