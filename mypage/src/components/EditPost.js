// src/components/EditPost.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { AuthContext } from '../context/AuthContext';
import heic2any from 'heic2any';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';
import { useQuillToolbar } from './QuillToolbar';
import { registerCustomImageBlot } from './QuillCustomBlots';
import CustomFormulaEditor from './CustomFormulaEditor'; // 커스텀 수식 편집기 추가
import '../style/SettingsWriting.css';
import '../style/QuillToolbar.css';
import '../style/CustomFormulaEditor.css'; // 커스텀 수식 편집기 스타일 추가

// 사용자 정의 블롯 등록
registerCustomImageBlot();

// Firestore 제한 상수
const MAX_CONTENT_SIZE = 1000000; // 약 1MB (안전 마진 포함)

function EditPost() {
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

  // 커스텀 수식 편집기 상태
  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [formulaInitialValue, setFormulaInitialValue] = useState('');
  const [onFormulaSave, setOnFormulaSave] = useState(null);

  const quillRef = useRef(null);

  const { modules, formats, handleImageUpload } = useQuillToolbar();

  // 커스텀 수식 편집기 연동
  useEffect(() => {
    window.openFormulaEditor = (initialValue, onSaveCallback) => {
      setFormulaInitialValue(initialValue);
      setOnFormulaSave(() => onSaveCallback);
      setIsFormulaEditorOpen(true);
    };
    return () => {
      window.openFormulaEditor = null;
    };
  }, []);

  const calculateContentSize = (htmlContent) => {
    const textContent = htmlContent.replace(/<[^>]*>/g, '');
    return new Blob([textContent]).size;
  };

  const handleContentChange = (newContent) => {
    setContent(newContent);
    const size = calculateContentSize(newContent);
    setContentSize(size);
  };

  const extractImageUrls = (content) => {
    if (!content) return [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    const urls = [];
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      const url = match[1];
      if ((url.startsWith('https://firebasestorage.googleapis.com') && url.includes('/o/') && !url.includes('undefined') && !url.includes('null') && url.length > 50) || url.startsWith('data:image/')) {
        if (url.startsWith('data:image/')) {
          urls.push(url);
        } else {
          try {
            const urlObj = new URL(url);
            if (urlObj.pathname.includes('/o/')) urls.push(url);
          } catch (e) { /* ignore invalid urls */ }
        }
      }
    }
    return urls;
  };

  const extractStoragePath = (imageUrl) => {
    if (!imageUrl.startsWith('https://firebasestorage.googleapis.com')) return null;
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      const oIndex = pathParts.findIndex(part => part === 'o');
      if (oIndex !== -1 && oIndex + 1 < pathParts.length) {
        let filePath = pathParts.slice(oIndex + 1).join('/');
        if (filePath.includes('%252F')) filePath = filePath.replace(/%252F/g, '/');
        const decodedPath = decodeURIComponent(filePath);
        if (decodedPath && decodedPath !== 'media' && !decodedPath.includes('?') && decodedPath.length > 0 && !decodedPath.includes('undefined') && !decodedPath.includes('null')) {
          return decodedPath;
        }
      }
    } catch (e) { /* ignore parsing failure */ }
    return null;
  };

  const isSameStorageImage = (url1, url2) => {
    if (!url1 || !url2) return false;
    if (url1.startsWith('https://firebasestorage.googleapis.com') && url2.startsWith('https://firebasestorage.googleapis.com')) {
      const path1 = extractStoragePath(url1);
      const path2 = extractStoragePath(url2);
      if (path1 && path2) return path1 === path2;
    }
    return url1 === url2;
  };

  const convertHeicToJpeg = async (file) => {
    if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      try {
        const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        return new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
      } catch (error) {
        throw new Error('HEIC 파일 변환에 실패했습니다.');
      }
    }
    return file;
  };

  const handleImageInsert = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*,.heic,.heif');
    input.setAttribute('capture', 'environment');
    input.click();
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const processedFile = await convertHeicToJpeg(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          const tempUrl = e.target.result;
          const tempImage = { id: Date.now(), file: processedFile, tempUrl };
          setPendingImages(prev => [...prev, tempImage]);
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
      if (window.innerWidth <= 480) setEditorHeight('300px');
      else if (window.innerWidth <= 768) setEditorHeight('350px');
      else setEditorHeight('400px');
    };
    updateEditorHeight();
    window.addEventListener('resize', updateEditorHeight);
    return () => window.removeEventListener('resize', updateEditorHeight);
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docRef = doc(db, categoryParam, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || '');
          setContent(data.content || '');
          setCategory(data.category || categoryParam);
          const existingImages = extractImageUrls(data.content || '');
          setOriginalImageUrls(existingImages);
          setContentSize(calculateContentSize(data.content || ''));
        } else {
          setError('Post not found.');
        }
      } catch (err) {
        setError('Failed to load post for editing.');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [categoryParam, id]);

  const deleteImagesFromStorage = async (imageUrls) => {
    const deletePromises = imageUrls.map(async (imageUrl) => {
      try {
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
          const decodedPath = extractStoragePath(imageUrl);
          if (decodedPath && (decodedPath.includes(uid) || role === 'admin')) {
            const imageRef = ref(storage, decodedPath);
            await deleteObject(imageRef);
          }
        }
      } catch (error) { /* ignore individual delete errors */ }
    });
    await Promise.allSettled(deletePromises);
  };

  useEffect(() => {
    const setupEditor = () => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          window.quillEditor = editor;
          try {
            const toolbar = editor.getModule('toolbar');
            if (toolbar && typeof handleImageInsert === 'function') {
              toolbar.addHandler('image', handleImageInsert);
            }
          } catch (error) { /* ignore errors */ }
          return true;
        }
      }
      return false;
    };
    if (!setupEditor()) {
      const timer = setTimeout(() => !setupEditor() && console.warn('Editor setup failed'), 200);
      return () => clearTimeout(timer);
    }
  }, [handleImageInsert]);

  const uploadPendingImages = async () => {
    if (pendingImages.length === 0) return content;
    let updatedContent = content;
    for (const tempImage of pendingImages) {
      try {
        const url = await handleImageUpload(tempImage.file);
        if (url) updatedContent = updatedContent.replace(tempImage.tempUrl, url);
      } catch (err) {
        throw new Error(`이미지 업로드 실패: ${err.message}`);
      }
    }
    return updatedContent;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !(content || '').replace(/<p><br><\/p>/g, '').trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    if (contentSize > MAX_CONTENT_SIZE) {
      alert(`콘텐츠가 너무 깁니다. 최대: ${(MAX_CONTENT_SIZE / 1024).toFixed(1)}KB`);
      return;
    }
    setIsUploading(true);
    try {
      const finalContent = await uploadPendingImages();
      const currentImageUrls = extractImageUrls(finalContent);
      const currentStorageUrls = currentImageUrls.filter(url => url.startsWith('https://firebasestorage.googleapis.com'));
      const originalStorageUrls = originalImageUrls.filter(url => url.startsWith('https://firebasestorage.googleapis.com'));
      const removedImages = originalStorageUrls.filter(originalUrl => !currentStorageUrls.some(currentUrl => isSameStorageImage(originalUrl, currentUrl)));
      if (removedImages.length > 0) {
        const confirmDelete = window.confirm(`정말로 ${removedImages.length}개의 이미지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`);
        if (confirmDelete) await deleteImagesFromStorage(removedImages);
      }
      const docRef = doc(db, categoryParam, id);
      await updateDoc(docRef, { title: title.trim(), content: finalContent, category: category.trim() });
      alert('Post updated successfully!');
      if (window.opener) {
        window.opener.location.reload();
        window.close();
      } else {
        navigate(`/posts/${category}/${id}`, { replace: true, state: { refresh: true } });
      }
    } catch (err) {
      alert('Error updating post: ' + err.message);
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
                  <input type="text" className="form-control writing-input" id="titleInput" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="col-md-3">
                  <label htmlFor="categorySelect" className="form-label writing-label">Category</label>
                  <select className="form-select writing-select" id="categorySelect" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="study">Study</option>
                    <option value="blog">Blog</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <div className="writing-editor-container">
                  <ReactQuill ref={quillRef} className="writing-quill" theme="snow" value={content} onChange={handleContentChange} modules={modules} formats={formats} style={{ height: editorHeight }} />
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
      <CustomFormulaEditor
        isOpen={isFormulaEditorOpen}
        onClose={() => setIsFormulaEditorOpen(false)}
        onSave={(latex) => {
          if (typeof onFormulaSave === 'function') {
            onFormulaSave(latex);
          }
        }}
        initialValue={formulaInitialValue}
      />
    </>
  );
}

export default EditPost;