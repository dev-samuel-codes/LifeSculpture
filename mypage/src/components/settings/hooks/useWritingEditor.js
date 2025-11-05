import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase/firebase';
import { useQuillToolbar } from '../../text-editor/hooks/useQuillToolbar';
import {
  calculateContentSize,
  sanitizeContent,
} from '../../text-editor/utils/content';
import { convertHeicToJpeg } from '../../text-editor/utils/media';
import { getResponsiveEditorHeight } from '../../text-editor/utils/layout';

const MAX_CONTENT_SIZE = 1000000;

const useWritingEditor = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('study');
  const [isPublic, setIsPublic] = useState(true);
  const [editorHeight, setEditorHeight] = useState('400px');
  const [contentSize, setContentSize] = useState(0);
  const [pendingImages, setPendingImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [formulaInitialValue, setFormulaInitialValue] = useState('');
  const formulaSaveRef = useRef(null);

  const quillRef = useRef(null);
  const lastSubmitAtRef = useRef(0);

  const { modules, formats, handleImageUpload } = useQuillToolbar();

  const handleContentChange = useCallback(
    (newContent) => {
      setContent(newContent);
      setContentSize(calculateContentSize(newContent));
    },
    [],
  );

  const handleImageInsert = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.click();

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        const processedFile = await convertHeicToJpeg(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          const tempUrl = e.target?.result;
          if (!tempUrl) return;

          setPendingImages((prev) => [...prev, { id: Date.now(), file: processedFile, tempUrl }]);
          const editor = quillRef.current?.getEditor();
          if (editor) {
            const range = editor.getSelection(true) || { index: editor.getLength() };
            editor.insertEmbed(range.index, 'image', tempUrl, 'user');
            editor.setSelection(range.index + 1, 0);
          }
        };
        reader.readAsDataURL(processedFile);
      } catch (error) {
        alert('이미지 처리 실패: ' + error.message);
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
    const setupEditor = () => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return false;

      window.quillEditor = editor;
      window.openFormulaEditor = (initialValue, onSaveCallback) => {
        setFormulaInitialValue(initialValue);
        formulaSaveRef.current = onSaveCallback;
        setIsFormulaEditorOpen(true);
      };
      editor.getModule('toolbar')?.addHandler('image', handleImageInsert);
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
  }, [handleImageInsert]);

  const uploadPendingImages = useCallback(async () => {
    if (pendingImages.length === 0) return content;
    let updated = content;

    for (const { file, tempUrl } of pendingImages) {
      const url = await handleImageUpload(file).catch(() => null);
      if (url) {
        updated = updated.replace(tempUrl, url);
      }
    }
    return updated;
  }, [content, handleImageUpload, pendingImages]);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setCategory('study');
    setIsPublic(true);
    setPendingImages([]);
    setContentSize(0);
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const now = Date.now();
      if (now - lastSubmitAtRef.current < 1500) return;
      lastSubmitAtRef.current = now;

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert('로그인이 필요합니다.');
        return;
      }

      if (!category || !title.trim() || !sanitizeContent(content)) {
        alert('제목, 카테고리, 내용을 모두 입력해주세요.');
        return;
      }

      if (contentSize > MAX_CONTENT_SIZE) {
        alert(`콘텐츠가 너무 깁니다. 최대: ${MAX_CONTENT_SIZE / 1024}KB`);
        return;
      }

      setIsUploading(true);
      try {
        const finalContent = await uploadPendingImages();
        const docRef = await addDoc(collection(db, category), {
          title: title.trim(),
          content: finalContent,
          createdAt: serverTimestamp(),
          viewCount: 0,
          isPublic,
        });

        alert('게시글이 성공적으로 등록되었습니다!');
        resetForm();
        navigate(`/${category}/${docRef.id}`);
      } catch (error) {
        console.error('[SettingsWriting] 게시글 등록 실패:', error);
        alert('게시글 등록 실패: ' + error.message);
      } finally {
        setIsUploading(false);
      }
    },
    [category, content, contentSize, isPublic, navigate, resetForm, title, uploadPendingImages],
  );

  const closeFormulaEditor = useCallback(() => {
    setIsFormulaEditorOpen(false);
    setFormulaInitialValue('');
    formulaSaveRef.current = null;
  }, []);

  const handleFormulaSave = useCallback(
    (latex) => {
      if (typeof formulaSaveRef.current === 'function') {
        formulaSaveRef.current(latex);
      }
      closeFormulaEditor();
    },
    [closeFormulaEditor],
  );

  return useMemo(
    () => ({
      quillRef,
      state: {
        title,
        content,
        category,
        isPublic,
        editorHeight,
        isUploading,
        isFormulaEditorOpen,
        formulaInitialValue,
      },
      actions: {
        setTitle,
        setCategory,
        setIsPublic,
        handleContentChange,
        handleSubmit,
        handleFormulaSave,
        closeFormulaEditor,
      },
      quill: {
        modules,
        formats,
      },
    }),
    [
      category,
      closeFormulaEditor,
      content,
      editorHeight,
      formulaInitialValue,
      handleContentChange,
      handleFormulaSave,
      handleSubmit,
      isFormulaEditorOpen,
      isPublic,
      isUploading,
      modules,
      formats,
      title,
    ],
  );
};

export default useWritingEditor;
