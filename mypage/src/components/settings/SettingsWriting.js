// src/components/SettingsWriting.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsMenu from './SettingsMenu';
import { db } from '../../firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import heic2any from 'heic2any';
import { useQuillToolbar } from '../text-editor/QuillToolbar';
import { registerCustomImageBlot } from '../text-editor/QuillCustomBlots';
import CustomFormulaEditor from '../text-editor/CustomFormulaEditor';
import '../../style/SettingsWriting.css';
import '../../style/QuillToolbar.css';
import '../../style/CustomFormulaEditor.css';
import '../../style/RichText.css';

registerCustomImageBlot();

const MAX_CONTENT_SIZE = 1000000;

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('study');
  const [editorHeight, setEditorHeight] = useState('400px');
  const [isPublic, setIsPublic] = useState(true);
  const [contentSize, setContentSize] = useState(0);
  const [pendingImages, setPendingImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [formulaInitialValue, setFormulaInitialValue] = useState('');
  const [onFormulaSave, setOnFormulaSave] = useState(null);

  const quillRef = useRef(null);
  const navigate = useNavigate();

  const { modules, formats, handleImageUpload } = useQuillToolbar();

  const calculateContentSize = (htmlContent) => {
    const textContent = htmlContent.replace(/<[^>]*>/g, '');
    return new Blob([textContent]).size;
  };

  const handleContentChange = (newContent) => {
    setContent(newContent);
    setContentSize(calculateContentSize(newContent));
  };

  const convertHeicToJpeg = async (file) => {
    if (/image\/(heic|heif)/.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
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
      const height = window.innerWidth <= 480 ? '300px' : (window.innerWidth <= 768 ? '350px' : '400px');
      setEditorHeight(height);
    };
    updateEditorHeight();
    window.addEventListener('resize', updateEditorHeight);
    return () => window.removeEventListener('resize', updateEditorHeight);
  }, []);

  // Editor setup effect - 통합된 버전
  useEffect(() => {
    const setupEditor = () => {
      const editor = quillRef.current?.getEditor();
      if (editor) {
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
  }, [handleImageInsert]);

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
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return alert('로그인이 필요합니다.');
    if (!category || !title.trim() || !content.trim().replace(/<p><br><\/p>/g, '')) {
      return alert('제목, 카테고리, 내용을 모두 입력해주세요.');
    }
    if (contentSize > MAX_CONTENT_SIZE) {
      return alert(`콘텐츠가 너무 깁니다. 최대: ${MAX_CONTENT_SIZE / 1024}KB`);
    }
    setIsUploading(true);
    try {
      const finalContent = await uploadPendingImages();
      const docRef = await addDoc(collection(db, category), {
        title: title.trim(),
        content: finalContent,
        createdAt: serverTimestamp(),
        viewCount: 0,
        isPublic: isPublic,
      });
      alert('게시글이 성공적으로 등록되었습니다!');
      navigate(`/${category}/${docRef.id}`);
    } catch (e) {
      alert('게시글 등록 실패: ' + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="container mt-4 h-100">
        <div className="row settings-row d-flex h-100">
          <SettingsMenu />
          <div className="col-md-9 h-100 flex-grow-1 settings-writing-container">
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
                <div className="writing-actions">
                  <div className="public-switch-container d-none d-md-flex">
                    <label className="switch">
                      <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                      <span className="slider round"></span>
                    </label>
                    <span className="ms-2">{isPublic ? '공개' : '비공개'}</span>
                  </div>
                  <button type="submit" className="btn btn-primary btn-primary-solid" disabled={isUploading}>
                    {isUploading ? '업로드 중...' : '게시하기'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      <CustomFormulaEditor
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

export default SettingsWriting;
