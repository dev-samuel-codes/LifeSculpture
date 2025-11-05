// src/pages/EditPostPage.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { AuthContext } from '../context/AuthContext';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';
import { TextEditorFormulaDialog, registerTextEditorImageBlot, useQuillToolbar } from '../components';
import { calculateContentSize, sanitizeHtml } from '../components/text-editor/utils/content';
import {
  convertHeicToJpeg,
  extractImageUrls,
  extractStoragePath,
  isSameStorageImage,
} from '../components/text-editor/utils/media';
import { getResponsiveEditorHeight } from '../components/text-editor/utils/layout';
import '../style/SettingsWriting.css';
import '../style/QuillToolbar.css';
import '../style/CustomFormulaEditor.css';
import '../style/RichText.css';

registerTextEditorImageBlot();

const MAX_CONTENT_SIZE = 1000000;

function EditPostPage() {
  const { category: categoryParam, id } = useParams();
  const navigate = useNavigate();
  const { uid, role } = useContext(AuthContext);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editorHeight, setEditorHeight] = useState('400px');
  const [contentSize, setContentSize] = useState(0);
  const [pendingImages, setPendingImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [originalImageUrls, setOriginalImageUrls] = useState([]);

  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [formulaInitialValue, setFormulaInitialValue] = useState('');
  const [onFormulaSave, setOnFormulaSave] = useState(null);

  const quillRef = useRef(null);
  const { modules, formats, handleImageUpload } = useQuillToolbar();

  const shouldTrackImage = useCallback(
    (url) =>
      (url.startsWith('https://firebasestorage.googleapis.com') && url.includes('/o/')) ||
      url.startsWith('data:image/'),
    [],
  );

  const getTrackedImageUrls = useCallback(
    (html) => extractImageUrls(html, { filter: shouldTrackImage }),
    [shouldTrackImage],
  );

  const handleContentChange = (newContent) => {
    setContent(newContent);
    setContentSize(calculateContentSize(newContent));
  };

  const handleImageInsert = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*,.heic,.heif');
    input.click();
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const processedFile = await convertHeicToJpeg(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          const tempUrl = e.target.result;
          setPendingImages(prev => [...prev, { id: Date.now(), file: processedFile, tempUrl }]);
          const editor = quillRef.current?.getEditor();
          if (editor) {
            const range = editor.getSelection(true) || { index: editor.getLength() };
            editor.insertEmbed(range.index, 'image', tempUrl, 'user');
            editor.setSelection(range.index + 1, 0);
          }
        };
        reader.readAsDataURL(processedFile);
      } catch (err) {
        alert('이미지 처리 실패: ' + err.message);
      }
    };
  }, []);

  useEffect(() => {
    const updateEditorHeight = () => {
      setEditorHeight(getResponsiveEditorHeight());
    };
    updateEditorHeight();
    window.addEventListener('resize', updateEditorHeight);
    return () => window.removeEventListener('resize', updateEditorHeight);
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const snap = await getDoc(doc(db, categoryParam, id));
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || '');
          setContent(data.content || '');
          setCategory(data.category || categoryParam);
          setOriginalImageUrls(getTrackedImageUrls(data.content || ''));
          setContentSize(calculateContentSize(data.content || ''));
        } else {
          setError('Post not found.');
        }
      } catch (err) {
        setError('Failed to load post.');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [categoryParam, getTrackedImageUrls, id]);

  const deleteImagesFromStorage = async (imageUrls) => {
    const promises = imageUrls.map(url => {
      const path = extractStoragePath(url);
      if (path && (path.includes(uid) || role === 'admin')) {
        return deleteObject(ref(storage, path)).catch(() => {});
      }
      return null;
    });
    await Promise.all(promises.filter(p => p));
  };

  // Editor setup effect - 통합된 버전
  useEffect(() => {
    const setupEditor = () => {
      const editor = quillRef.current?.getEditor();
      if (editor) {
        // 전역 참조 및 핸들러 설정
        window.quillEditor = editor;
        window.openFormulaEditor = (initialValue, onSaveCallback) => {
          setFormulaInitialValue(initialValue);
          setOnFormulaSave(() => onSaveCallback);
          setIsFormulaEditorOpen(true);
        };
        editor.getModule('toolbar').addHandler('image', handleImageInsert);
        return true;
      }
      return false;
    };

    // Quill이 렌더링될 때까지 지연 실행
    const timer = setTimeout(() => {
        if (!setupEditor()) {
            const retryTimer = setTimeout(setupEditor, 300);
            return () => clearTimeout(retryTimer);
        }
    }, 100);

    return () => {
      clearTimeout(timer);
      window.openFormulaEditor = null; // Cleanup
    };
  }, [loading, handleImageInsert]); // 로딩 상태가 변경될 때도 실행

  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const codeBlocks = editor.root.querySelectorAll('pre');
      codeBlocks.forEach(block => {
        block.style.whiteSpace = 'pre';
        block.style.overflowX = 'auto';
        block.style.maxWidth = '800px';
        block.style.margin = '1.75rem auto';
      });
    }
  }, [content]);

  const uploadPendingImages = async () => {
    if (pendingImages.length === 0) return content;
    let updatedContent = content;
    for (const { file, tempUrl } of pendingImages) {
      const url = await handleImageUpload(file).catch(() => null);
      if (url) updatedContent = updatedContent.replace(tempUrl, url);
    }
    return updatedContent;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !sanitizeHtml(content)) {
      return alert('제목과 내용을 입력해주세요.');
    }
    if (contentSize > MAX_CONTENT_SIZE) {
      return alert(`콘텐츠가 너무 깁니다. 최대: ${MAX_CONTENT_SIZE / 1024}KB`);
    }
    setIsUploading(true);
    try {
      const finalContent = await uploadPendingImages();
      const currentUrls = getTrackedImageUrls(finalContent).filter((url) => url.startsWith('https'));
      const originalUrls = originalImageUrls.filter((url) => url.startsWith('https'));
      const removedUrls = originalUrls.filter((url) =>
        !currentUrls.some((cUrl) => isSameStorageImage(url, cUrl))
      );
      if (removedUrls.length > 0 && window.confirm(`${removedUrls.length}개의 이미지를 삭제하시겠습니까?`)) {
        await deleteImagesFromStorage(removedUrls);
      }
      await updateDoc(doc(db, categoryParam, id), { title: title.trim(), content: sanitizeHtml(finalContent), category: category.trim() });
      alert('게시글이 성공적으로 수정되었습니다.');
      if (window.opener) {
        window.opener.location.reload();
        window.close();
      } else {
        navigate(`/posts/${category}/${id}`, { replace: true });
      }
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="container mt-4">Loading...</div>;
  if (error) return <div className="container mt-4 text-danger">Error: {error}</div>;

  return (
    <>
      <div className="container mt-4 h-100">
        <div className="settings-writing-container">
          <form onSubmit={handleSubmit} className="writing-form">
            <div className="writing-fields-group">
              <div className="row mb-3 writing-row">
                <div className="col-md-9">
                  <label htmlFor="titleInput" className="form-label writing-label">Title</label>
                  <input type="text" className="form-control" id="titleInput" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="col-md-3">
                  <label htmlFor="categorySelect" className="form-label writing-label">Category</label>
                  <select className="form-select" id="categorySelect" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="study">Study</option>
                    <option value="blog">Blog</option>
                  </select>
                </div>
              </div>
                <div className="mb-3">
                  <div
                    className="writing-editor-container"
                    style={{ '--rich-text-editor-height': editorHeight }}
                  >
                  <ReactQuill
                    ref={quillRef}
                    className="writing-editor rich-text-editor"
                    theme="snow"
                    value={content}
                    onChange={handleContentChange}
                    modules={modules}
                    formats={formats}
                    style={{ height: 'auto', '--rich-text-editor-height': editorHeight }}
                  />
                  </div>
                </div>
              <div className="writing-actions d-flex justify-content-end">
                <button type="submit" className="btn btn-primary btn-primary-solid" disabled={isUploading}>
                  {isUploading ? '업로드 중...' : '수정하기'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <TextEditorFormulaDialog
        isOpen={isFormulaEditorOpen}
        onClose={() => setIsFormulaEditorOpen(false)}
        onSave={(latex) => {
          if (typeof onFormulaSave === 'function') onFormulaSave(latex);
        }}
        initialValue={formulaInitialValue}
      />
    </>
  );
}

export default EditPostPage;
