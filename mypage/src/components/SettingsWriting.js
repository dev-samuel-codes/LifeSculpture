// src/components/SettingsWriting.js
import React, { useRef, useState, useMemo, useCallback } from 'react';
import SettingsMenu from './SettingsMenu';
import { db, storage } from '../firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import '../style/SettingsWriting.css';

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [category, setCategory] = useState('study');

  const quillRef = useRef(null);

  // 이미지 업로드 → Storage 저장 → URL 반환
  const handleImageUpload = useCallback(async (file) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      alert('로그인이 필요합니다. 관리자 계정으로 로그인 후 다시 시도하세요.');
      return null;
    }
    if (!file) return null;

    const MAX_MB = 15;
    if (!file.type?.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있어요.');
      return null;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`이미지 용량이 큽니다. 최대 ${MAX_MB}MB까지 업로드할 수 있어요.`);
      return null;
    }

    try {
      console.log('[UPLOAD] start:', {
        name: file.name,
        size: file.size,
        type: file.type,
        bucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        uid: user.uid,
      });

      // 경로는 공개 읽기 정책에 맞춰 post-images 아래로 정리
      const path = `post-images/${Date.now()}-${file.name}`;
      const imgRef = storageRef(storage, path);
      const metadata = { contentType: file.type };

      const snap = await uploadBytes(imgRef, file, metadata);
      console.log('[UPLOAD] done:', {
        fullPath: snap.metadata.fullPath,
        contentType: snap.metadata.contentType,
        size: snap.metadata.size,
      });

      const url = await getDownloadURL(snap.ref);
      console.log('[URL] generated:', url);
      return url;
    } catch (err) {
      console.error('[UPLOAD] failed:', {
        code: err?.code,
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      });
      if (err?.code === 'storage/unauthorized' || err?.code === 'permission-denied') {
        alert('이미지 업로드 권한이 없습니다. 관리자 계정인지 확인하세요.');
      } else {
        alert('이미지 업로드에 실패했어요. 콘솔의 [UPLOAD] failed 로그를 캡처해서 알려주세요!');
      }
      return null;
    }
  }, []);

  // Quill 이미지 버튼 핸들러: Base64 대신 Storage URL 삽입
  const imageHandler = useCallback(() => {
    console.log('[imageHandler] called');
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      console.log('[imageHandler] onchange');
      const file = input.files && input.files[0];
      if (!file) {
        console.log('[imageHandler] no file selected');
        return;
      }

      try {
        console.log('[imageHandler] uploading file:', file.name);
        const url = await handleImageUpload(file);
        console.log('[imageHandler] upload result url:', url);
        if (!url) return;

        const editor = quillRef.current?.getEditor?.();
        if (!editor) {
          console.error('[QUILL] editor not ready');
          alert('에디터가 아직 준비되지 않았어요. 페이지를 새로고침 후 다시 시도해보세요.');
          return;
        }

        const range = editor.getSelection(true) || { index: editor.getLength() };
        console.log('[imageHandler] inserting image at:', range.index);
        editor.insertEmbed(range.index, 'image', url, 'user');
        editor.setSelection(range.index + 1, 0);
        console.log('[QUILL] image inserted at', range.index);
      } catch (err) {
        console.error('[HANDLER] failed:', err);
        alert('이미지 삽입에 실패했어요.');
      }
    };
  }, [handleImageUpload]);

  // 퀼 모듈: 커스텀 이미지 핸들러 적용
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, false] }],
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
          ['link', 'image', 'code-block'],
          ['clean'],
        ],
        handlers: { image: imageHandler },
      },
      clipboard: { matchVisual: false },
    }),
    [imageHandler]
  );

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'code-block',
  ];

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
              <div className="writing-editor" id="contentInput">
                <ReactQuill
                  ref={quillRef}
                  className="writing-quill"
                  theme="snow"
                  value={content}
                  onChange={setContent}
                  modules={modules}
                  formats={formats}
                />
              </div>
            </div>

            <div className="writing-actions">
              <button type="submit" className="btn btn-primary btn-primary-solid">Submit</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SettingsWriting;
