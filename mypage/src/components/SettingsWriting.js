// src/components/SettingsWriting.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import heic2any from 'heic2any'; // HEIC 변환 라이브러리 추가
import { useQuillToolbar } from './QuillToolbar';
import { registerCustomImageBlot } from './QuillCustomBlots'; // 사용자 정의 블롯 가져오기
import CustomFormulaEditor from './CustomFormulaEditor'; // 커스텀 수식 편집기 추가
import '../style/SettingsWriting.css';
import '../style/QuillToolbar.css';
import '../style/CustomFormulaEditor.css'; // 커스텀 수식 편집기 스타일 추가

// 사용자 정의 블롯 등록
registerCustomImageBlot();

// Firestore 제한 상수
const MAX_CONTENT_SIZE = 1000000; // 약 1MB (안전 마진 포함)

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // HTML string
  const [category, setCategory] = useState('study');
  const [editorHeight, setEditorHeight] = useState('400px');
  const [isPublic, setIsPublic] = useState(true); // 공개/비공개 상태
  const [contentSize, setContentSize] = useState(0); // content 크기 추적
  const [pendingImages, setPendingImages] = useState([]); // 임시 저장된 이미지들
  const [isUploading, setIsUploading] = useState(false); // 업로드 중 상태
  const [shouldRedirect, setShouldRedirect] = useState(false); // 리다이렉트 플래그

  // 커스텀 수식 편집기 상태
  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [formulaInitialValue, setFormulaInitialValue] = useState('');
  const [onFormulaSave, setOnFormulaSave] = useState(null);

  const quillRef = useRef(null);
  const navigate = useNavigate();

  // 공통 툴바 훅 사용
  const quillToolbar = useQuillToolbar();
  const { modules, formats, handleImageUpload } = quillToolbar || {
    modules: {},
    formats: [],
    handleImageUpload: () => {}
  };

  // 커스텀 수식 편집기 연동
  useEffect(() => {
    window.openFormulaEditor = (initialValue, onSaveCallback) => {
      setFormulaInitialValue(initialValue);
      setOnFormulaSave(() => onSaveCallback); // 함수를 저장
      setIsFormulaEditorOpen(true);
    };

    return () => {
      window.openFormulaEditor = null; // 컴포넌트 언마운트 시 정리
    };
  }, []);

  // content 크기 계산 함수
  const calculateContentSize = (htmlContent) => {
    const textContent = htmlContent.replace(/<[^>]*>/g, '');
    return new Blob([textContent]).size;
  };

  // content 변경 시 크기 추적
  const handleContentChange = (newContent) => {
    setContent(newContent);
    const size = calculateContentSize(newContent);
    setContentSize(size);
  };

  // HEIC 파일을 JPEG로 변환하는 함수
  const convertHeicToJpeg = async (file) => {
    if (file.type === 'image/heic' || file.type === 'image/heif' || 
        file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      try {
        const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        const convertedFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        return convertedFile;
      } catch (error) {
        console.error('[convertHeicToJpeg] HEIC 변환 실패:', error);
        throw new Error('HEIC 파일 변환에 실패했습니다.');
      }
    }
    return file;
  };

  // 이미지 핸들러 - 임시 저장용
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
          const tempImage = {
            id: Date.now() + Math.random(),
            file: processedFile,
            originalFile: file,
            name: file.name,
            size: file.size,
            type: file.type,
            tempUrl: tempUrl,
            isHeicConverted: processedFile !== file
          };
          setPendingImages(prev => [...prev, tempImage]);
          const editor = quillRef.current?.getEditor();
          if (editor) {
            const range = editor.getSelection(true) || { index: editor.getLength() };
            const [line] = editor.getLine(range.index);
            const formats = line ? line.formats() : {};
            const currentAlign = formats.align || '';
            editor.insertEmbed(range.index, 'image', tempUrl, 'user');
            if (currentAlign) {
              setTimeout(() => {
                const newRange = { index: range.index, length: 1 };
                editor.formatLine(newRange.index, newRange.length, 'align', currentAlign);
              }, 10);
            }
            editor.setSelection(range.index + 1, 0);
          }
        };
        reader.readAsDataURL(processedFile);
      } catch (err) {
        alert('이미지 처리 실패: ' + err.message);
      }
    };
  }, []);

  // 화면 크기에 따른 에디터 높이 조정
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

  // 에디터가 준비되면 전역 참조 설정
  useEffect(() => {
    const setupEditor = () => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          window.quillEditor = editor;
          editor.getModule('toolbar').addHandler('image', handleImageInsert);
          return true;
        }
      }
      return false;
    };
    if (!setupEditor()) {
      const timer = setTimeout(() => {
        if (!setupEditor()) console.warn('[SettingsWriting] editor setup failed after delay');
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [handleImageInsert]);

  // 게시하기 시 이미지들을 storage에 업로드
  const uploadPendingImages = async () => {
    if (pendingImages.length === 0) return content;
    let updatedContent = content;
    for (const tempImage of pendingImages) {
      try {
        const url = await handleImageUpload(tempImage.file);
        if (url) {
          updatedContent = updatedContent.replace(tempImage.tempUrl, url);
        }
      } catch (err) {
        throw new Error(`이미지 "${tempImage.name}" 업로드 실패: ${err.message}`);
      }
    }
    return updatedContent;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!category || !title.trim() || !content.replace(/<p><br><\/p>/g, '').trim()) {
      alert('제목, 카테고리, 내용을 모두 입력해주세요.');
      return;
    }
    if (contentSize > MAX_CONTENT_SIZE) {
      alert(`콘텐츠가 너무 깁니다. 최대: ${(MAX_CONTENT_SIZE / 1024).toFixed(1)}KB`);
      return;
    }
    setIsUploading(true);
    try {
      const finalContent = await uploadPendingImages();
      await addDoc(collection(db, category), {
        title: title.trim(),
        content: finalContent,
        createdAt: serverTimestamp(),
        viewCount: 0,
        isPublic: isPublic,
      });
      alert('게시글이 성공적으로 등록되었습니다!');
      setTitle('');
      setContent('');
      setContentSize(0);
      setPendingImages([]);
      setShouldRedirect(true);
      navigate(`/${category}`);
    } catch (e) {
      console.error('Error adding document: ', e);
      alert('게시글 등록에 실패했습니다: ' + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 리다이렉트 훅
  useEffect(() => {
    if (shouldRedirect) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldRedirect, navigate, category]);

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
                  <div className="writing-editor-container">
                    {modules && formats ? (
                      <ReactQuill
                        ref={quillRef}
                        className="writing-quill"
                        theme="snow"
                        value={content}
                        onChange={handleContentChange}
                        modules={modules}
                        formats={formats}
                        style={{ height: editorHeight }}
                      />
                    ) : (
                      <div className="alert alert-warning">에디터를 로드하는 중입니다...</div>
                    )}
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
          if (typeof onFormulaSave === 'function') {
            onFormulaSave(latex);
          }
        }}
        initialValue={formulaInitialValue}
      />
    </>
  );
}

export default SettingsWriting;