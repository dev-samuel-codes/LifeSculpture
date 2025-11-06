// src/pages/EditPostPage.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storage } from '../firebase/firebase';
import { AuthContext } from '../context/AuthContext';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';
import { TextEditorFormulaDialog, registerTextEditorImageBlot, useQuillToolbar } from '../components';
import { calculateContentSize, sanitizeHtml } from '../components/text-editor/utils/content';
import {
  convertHeicToJpeg,
  extractImageUrls,
  isSameStorageImage,
} from '../components/text-editor/utils/media';
import useResponsiveEditorHeight from '../hooks/useResponsiveEditorHeight';
import { deleteStorageImages } from '../utils/storage';
import { getPost, updatePostFields } from '../services/posts';
import '../style/components/settings/SettingsWriting.css';
import '../style/components/editor/QuillToolbar.css';
import '../style/components/editor/CustomFormulaEditor.css';
import '../style/components/editor/RichText.css';

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
  const [contentSize, setContentSize] = useState(0);
  const [pendingImages, setPendingImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [originalImageUrls, setOriginalImageUrls] = useState([]);

  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [formulaInitialValue, setFormulaInitialValue] = useState('');
  const [onFormulaSave, setOnFormulaSave] = useState(null);

  const quillRef = useRef(null);
  const editorHeight = useResponsiveEditorHeight();
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
        reader.onload = (event) => {
          const tempUrl = event.target.result;
          setPendingImages((prev) => [...prev, { id: Date.now(), file: processedFile, tempUrl }]);
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
    const fetchPost = async () => {
      try {
        const postData = await getPost({ category: categoryParam, id });
        if (postData) {
          const initialContent = postData.content || '';
          setTitle(postData.title || '');
          setContent(initialContent);
          setCategory(postData.category || categoryParam);
          setOriginalImageUrls(getTrackedImageUrls(initialContent));
          setContentSize(calculateContentSize(initialContent));
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

  useEffect(() => {
    const setupEditor = () => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return false;
      window.quillEditor = editor;
      window.openFormulaEditor = (initialValue, onSaveCallback) => {
        setFormulaInitialValue(initialValue);
        setOnFormulaSave(() => onSaveCallback);
        setIsFormulaEditorOpen(true);
      };
      editor.getModule('toolbar').addHandler('image', handleImageInsert);
      return true;
    };

    const timer = setTimeout(() => {
      if (!setupEditor()) {
        const retryTimer = setTimeout(setupEditor, 300);
        return () => clearTimeout(retryTimer);
      }
      return undefined;
    }, 100);

    return () => {
      clearTimeout(timer);
      window.openFormulaEditor = null;
    };
  }, [loading, handleImageInsert]);

  useEffect(() => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    const codeBlocks = editor.root.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
      block.style.whiteSpace = 'pre';
      block.style.overflowX = 'auto';
      block.style.maxWidth = '800px';
      block.style.margin = '1.75rem auto';
    });
  }, [content]);

  const uploadPendingImages = async () => {
    if (pendingImages.length === 0) return content;
    let updatedContent = content;
    for (const { file, tempUrl } of pendingImages) {
      const url = await handleImageUpload(file).catch(() => null);
      if (url) {
        updatedContent = updatedContent.replace(tempUrl, url);
      }
    }
    return updatedContent;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !sanitizeHtml(content)) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    if (contentSize > MAX_CONTENT_SIZE) {
      alert(`콘텐츠가 너무 깁니다. 최대: ${MAX_CONTENT_SIZE / 1024}KB`);
      return;
    }

    setIsUploading(true);
    try {
      const finalContent = await uploadPendingImages();
      const currentUrls = getTrackedImageUrls(finalContent).filter((url) => url.startsWith('https'));
      const originalUrls = originalImageUrls.filter((url) => url.startsWith('https'));
      const removedUrls = originalUrls.filter(
        (url) => !currentUrls.some((candidate) => isSameStorageImage(url, candidate)),
      );

      if (removedUrls.length > 0) {
        const confirmed = window.confirm(`${removedUrls.length}개의 이미지를 삭제하시겠습니까?`);
        if (confirmed) {
          await deleteStorageImages({ urls: removedUrls, storage, uid, role });
        }
      }

      await updatePostFields({
        category: categoryParam,
        id,
        data: {
          title: title.trim(),
          content: sanitizeHtml(finalContent),
          category: category.trim(),
        },
      });
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
                  <label htmlFor="titleInput" className="form-label writing-label">
                    Title
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="titleInput"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </div>
                <div className="col-md-3">
                  <label htmlFor="categorySelect" className="form-label writing-label">
                    Category
                  </label>
                  <select
                    className="form-select"
                    id="categorySelect"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option value="study">Study</option>
                    <option value="blog">Blog</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <div className="writing-editor-container" style={{ '--rich-text-editor-height': editorHeight }}>
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
