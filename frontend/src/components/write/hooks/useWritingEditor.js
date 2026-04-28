// useWritingEditor 훅: 글 작성 폼 상태와 편집기 동작을 관리
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase/firebase';
import { useQuillToolbar } from '../../text-editor/hooks/useQuillToolbar';
import useQuillEditorBridge from '../../text-editor/hooks/useQuillEditorBridge';
import { MAX_EDITOR_CONTENT_SIZE } from '../../text-editor/constants';
import { replacePendingImages } from '../../text-editor/utils/pendingImages';
import {
  calculateContentSize,
  sanitizeContent,
} from '../../text-editor/utils/content';
import { getResponsiveEditorHeight } from '../../text-editor/utils/layout';
import {
  hasContentStyleSettings,
  normalizeContentStyleSettings,
} from '../../text-editor/utils/contentStyleSettings';
import { extractHashtagsFromContent, mergePostTags } from '../../../utils/tags';

const AUTO_SAVE_DELAY = 2000;
const DRAFT_STORAGE_KEY = 'settings-writing-draft';
const DRAFT_TTL = 1000 * 60 * 60 * 24 * 30; // 30일

const useWritingEditor = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('study');
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState([]);
  const [contentStyleSettings, setContentStyleSettings] = useState(null);
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

  const handlePendingImage = useCallback(({ file, tempUrl }) => {
    setPendingImages((prev) => [...prev, { id: Date.now(), file, tempUrl }]);
  }, []);

  const handleOpenFormulaEditor = useCallback((initialValue, onSaveCallback) => {
    setFormulaInitialValue(initialValue);
    formulaSaveRef.current = onSaveCallback;
    setIsFormulaEditorOpen(true);
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
      setTags(Array.isArray(parsedDraft.tags) ? parsedDraft.tags : []);
      setContentStyleSettings(
        hasContentStyleSettings(parsedDraft.contentStyleSettings)
          ? normalizeContentStyleSettings(parsedDraft.contentStyleSettings)
          : null,
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
      isPublic !== true ||
      tags.length > 0 ||
      hasContentStyleSettings(contentStyleSettings);

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
          tags,
          ...(hasContentStyleSettings(contentStyleSettings)
            ? { contentStyleSettings: normalizeContentStyleSettings(contentStyleSettings) }
            : {}),
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
  }, [category, clearDraftStorage, content, contentStyleSettings, isPublic, tags, title]);

  useQuillEditorBridge({
    quillRef,
    enabled: true,
    content,
    onPendingImage: handlePendingImage,
    onOpenFormulaEditor: handleOpenFormulaEditor,
    onContentChange: handleContentChange,
  });

  const uploadPendingImages = useCallback(async ({ category: uploadCategory, postId } = {}) => {
    const resolvedCategory = uploadCategory || category;
    return replacePendingImages({
      content,
      pendingImages,
      category: resolvedCategory,
      postId,
      uploadImage: handleImageUpload,
    });
  }, [category, content, handleImageUpload, pendingImages]);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setCategory('study');
    setIsPublic(true);
    setTags([]);
    setContentStyleSettings(null);
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

      if (contentSize > MAX_EDITOR_CONTENT_SIZE) {
        alert(`콘텐츠가 너무 깁니다. 최대: ${MAX_EDITOR_CONTENT_SIZE / 1024}KB`);
        return;
      }

      setIsUploading(true);
      try {
        const docRef = doc(collection(db, category));
        const finalContent = await uploadPendingImages({
          category,
          postId: docRef.id,
        });
        const nextTags = mergePostTags(tags, extractHashtagsFromContent(finalContent));
        const normalizedStyleSettings = hasContentStyleSettings(contentStyleSettings)
          ? normalizeContentStyleSettings(contentStyleSettings)
          : null;
        const indexRef = doc(db, 'post_index', category, 'posts', docRef.id);
        const batch = writeBatch(db);
        batch.set(docRef, {
          title: title.trim(),
          content: finalContent,
          createdAt: serverTimestamp(),
          viewCount: 0,
          likeCount: 0,
          isPublic,
          tags: nextTags,
          ...(normalizedStyleSettings ? { contentStyleSettings: normalizedStyleSettings } : {}),
        });
        batch.set(indexRef, {
          title: title.trim(),
          createdAt: serverTimestamp(),
          viewCount: 0,
          likeCount: 0,
          isPublic,
          tags: nextTags,
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
    [
      category,
      content,
      contentSize,
      contentStyleSettings,
      isPublic,
      navigate,
      resetForm,
      tags,
      title,
      uploadPendingImages,
    ],
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
        tags,
        contentStyleSettings,
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
        setTags,
        setContentStyleSettings,
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
      contentStyleSettings,
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
      tags,
      title,
    ],
  );
};

export default useWritingEditor;
