// src/components/EditPost.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import '../style/EditPost.css';

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

  // ====== Image upload (Writing과 동일한 플로우) ======
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
      const path = `post-images/${Date.now()}-${file.name}`;
      const imgRef = storageRef(storage, path);
      const snap = await uploadBytes(imgRef, file, { contentType: file.type });
      const url = await getDownloadURL(snap.ref);
      return url;
    } catch (err) {
      console.error('[UPLOAD] failed:', err);
      if (err?.code === 'storage/unauthorized' || err?.code === 'permission-denied') {
        alert('이미지 업로드 권한이 없습니다. 관리자 계정인지 확인하세요.');
      } else {
        alert('이미지 업로드에 실패했어요. 콘솔 로그를 캡처해 알려주세요!');
      }
      return null;
    }
  }, []);

  // Quill 이미지 버튼 → Storage URL 삽입
  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
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
    };
  }, [handleImageUpload]);

  // Toolbar & formats (Writing과 톤 통일)
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
