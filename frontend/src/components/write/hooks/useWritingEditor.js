// useWritingEditor 훅: 글 작성 폼 상태와 편집기 동작을 관리
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase/firebase';
import { useQuillToolbar } from '../../text-editor/hooks/useQuillToolbar';
import {
  calculateContentSize,
  sanitizeContent,
} from '../../text-editor/utils/content';
import { convertHeicToJpeg } from '../../text-editor/utils/media';
import { getResponsiveEditorHeight } from '../../text-editor/utils/layout';
import { setupResponsiveImageSizing } from '../../text-editor/utils/imageSizing';
import { extractHashtagsFromContent } from '../../../utils/tags';

const MAX_CONTENT_SIZE = 1000000;
const AUTO_SAVE_DELAY = 2000;
const DRAFT_STORAGE_KEY = 'settings-writing-draft';
const DRAFT_TTL = 1000 * 60 * 60 * 24 * 30; // 30일

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
  const [draftStatus, setDraftStatus] = useState('idle');
  const [draftUpdatedAt, setDraftUpdatedAt] = useState(null);

  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [formulaInitialValue, setFormulaInitialValue] = useState('');
  const formulaSaveRef = useRef(null);

  const quillRef = useRef(null);
  const lastSubmitAtRef = useRef(0);
  const skipNextAutoSaveRef = useRef(false);

  const { modules, formats, handleImageUpload } = useQuillToolbar();

  const handleContentChange = useCallback(
    (newContent) => {
      setContent(newContent);
      setContentSize(calculateContentSize(newContent));
    },
    [],
  );

  const clearDraftStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[WritePostPage] 임시 저장본 삭제 실패:', error);
      }
    }
    setDraftStatus('idle');
    setDraftUpdatedAt(null);
  }, []);

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
    if (typeof window === 'undefined') return;

    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;

      const parsedDraft = JSON.parse(rawDraft);
      if (!parsedDraft || typeof parsedDraft !== 'object') return;

      if (
        parsedDraft.updatedAt &&
        Date.now() - parsedDraft.updatedAt > DRAFT_TTL
      ) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }

      setTitle(parsedDraft.title ?? '');
      setContent(parsedDraft.content ?? '');
      setCategory(parsedDraft.category ?? 'study');
      setIsPublic(
        typeof parsedDraft.isPublic === 'boolean' ? parsedDraft.isPublic : true,
      );
      setDraftUpdatedAt(parsedDraft.updatedAt ?? Date.now());
      setDraftStatus('loaded');
      skipNextAutoSaveRef.current = true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[WritePostPage] 임시 저장본 불러오기 실패:', error);
      }
    }
  }, [setCategory, setContent, setIsPublic, setTitle]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return undefined;
    }

    const sanitized = sanitizeContent(content);
    const shouldPersistDraft =
      title.trim().length > 0 ||
      Boolean(sanitized) ||
      category !== 'study' ||
      isPublic !== true;

    if (!shouldPersistDraft) {
      clearDraftStorage();
      return undefined;
    }

    setDraftStatus('saving');

    const timer = setTimeout(() => {
      try {
        const payload = {
          title,
          content,
          category,
          isPublic,
          updatedAt: Date.now(),
        };
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify(payload),
        );
        setDraftUpdatedAt(payload.updatedAt);
        setDraftStatus('saved');
      } catch (error) {
        setDraftStatus('error');
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[WritePostPage] 임시 저장 실패:', error);
        }
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      clearTimeout(timer);
    };
  }, [category, clearDraftStorage, content, isPublic, title]);

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

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return undefined;

    return setupResponsiveImageSizing({ root: editor.root });
  }, [content]);

  const uploadPendingImages = useCallback(async ({ category: uploadCategory, postId } = {}) => {
    if (pendingImages.length === 0) return content;
    let updated = content;
    const resolvedCategory = uploadCategory || category;

    for (const { file, tempUrl } of pendingImages) {
      const url = await handleImageUpload(file, { category: resolvedCategory, postId });
      if (!url) {
        throw new Error('이미지 업로드에 실패했습니다.');
      }
      updated = updated.replace(tempUrl, url);
    }
    return updated;
  }, [category, content, handleImageUpload, pendingImages]);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setCategory('study');
    setIsPublic(true);
    setPendingImages([]);
    setContentSize(0);
    clearDraftStorage();
  }, [clearDraftStorage]);

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
        const docRef = doc(collection(db, category));
        const finalContent = await uploadPendingImages({
          category,
          postId: docRef.id,
        });
        const tags = extractHashtagsFromContent(finalContent);
        const indexRef = doc(db, 'post_index', category, 'posts', docRef.id);
        const batch = writeBatch(db);
        batch.set(docRef, {
          title: title.trim(),
          content: finalContent,
          createdAt: serverTimestamp(),
          viewCount: 0,
          likeCount: 0,
          isPublic,
          tags,
        });
        batch.set(indexRef, {
          title: title.trim(),
          createdAt: serverTimestamp(),
          viewCount: 0,
          likeCount: 0,
          isPublic,
          tags,
        });
        await batch.commit();

        alert('게시글이 성공적으로 등록되었습니다!');
        resetForm();
        navigate(`/posts/${category}/${docRef.id}`);
      } catch (error) {
        console.error('[WritePostPage] 게시글 등록 실패:', error);
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
        draftStatus,
        draftUpdatedAt,
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
      draftStatus,
      draftUpdatedAt,
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
