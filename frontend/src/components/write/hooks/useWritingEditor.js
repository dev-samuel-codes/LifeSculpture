// useWritingEditor 훅: 글 작성 폼 상태와 편집기 동작을 관리
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { AuthContext } from '../../../context/AuthContext';
import { db, storage } from '../../../firebase/firebase';
import { useQuillToolbar } from '../../text-editor/hooks/useQuillToolbar';
import useQuillEditorBridge from '../../text-editor/hooks/useQuillEditorBridge';
import { MAX_EDITOR_CONTENT_SIZE } from '../../text-editor/constants';
import { replacePendingImages } from '../../text-editor/utils/pendingImages';
import {
  calculateContentSize,
  sanitizeContent,
  sanitizeHtml,
} from '../../text-editor/utils/content';
import { getResponsiveEditorHeight } from '../../text-editor/utils/layout';
import {
  hasContentStyleSettings,
  normalizeContentStyleSettings,
} from '../../text-editor/utils/contentStyleSettings';
import {
  extractContentTableSettingsFromRoot,
  hasContentTableSettings,
  normalizeContentTableSettings,
} from '../../text-editor/utils/contentTableSettings';
import { extractHashtagsFromContent, mergePostTags } from '../../../utils/tags';
import {
  deleteStorageObjects,
  preparePrivateImageContent,
} from '../../../utils/storage';

const AUTO_SAVE_DELAY = 2000;
const LEGACY_DRAFT_STORAGE_KEY = 'settings-writing-draft';
const DRAFT_STORAGE_PREFIX = 'settings-writing-draft:v2';
const DRAFT_TTL = 1000 * 60 * 60 * 24 * 30; // 열린 탭이 장기간 유지되는 경우를 위한 상한

const useWritingEditor = () => {
  const navigate = useNavigate();
  const { uid, loading: authLoading } = useContext(AuthContext) || {};
  const draftStorageKey = useMemo(
    () => (uid ? `${DRAFT_STORAGE_PREFIX}:${encodeURIComponent(uid)}` : null),
    [uid],
  );

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('study');
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState([]);
  const [contentStyleSettings, setContentStyleSettings] = useState(null);
  const [contentTableSettings, setContentTableSettings] = useState(null);
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
  const loadedDraftStorageKeyRef = useRef(null);

  const { modules, formats, handleImageUpload } = useQuillToolbar();

  const getReadyEditor = useCallback(() => {
    try {
      return quillRef.current?.getEditor?.() || null;
    } catch (error) {
      return null;
    }
  }, []);

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
      if (draftStorageKey) {
        window.sessionStorage.removeItem(draftStorageKey);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[WritePostPage] 임시 저장본 삭제 실패:', error);
      }
    }
    setDraftStatus('idle');
    setDraftUpdatedAt(null);
  }, [draftStorageKey]);

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
    if (typeof window === 'undefined' || authLoading) return;

    // Remove drafts written by the old shared localStorage implementation.
    try {
      window.localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[WritePostPage] 레거시 임시 저장본 삭제 실패:', error);
      }
    }

    if (!draftStorageKey) {
      loadedDraftStorageKeyRef.current = null;
      skipNextAutoSaveRef.current = true;
      setTitle('');
      setContent('');
      setCategory('study');
      setIsPublic(true);
      setTags([]);
      setContentStyleSettings(null);
      setContentTableSettings(null);
      setContentSize(0);
      setDraftUpdatedAt(null);
      setDraftStatus('idle');
      return;
    }

    if (loadedDraftStorageKeyRef.current === draftStorageKey) return;
    loadedDraftStorageKeyRef.current = draftStorageKey;
    skipNextAutoSaveRef.current = true;

    setTitle('');
    setContent('');
    setCategory('study');
    setIsPublic(true);
    setTags([]);
    setContentStyleSettings(null);
    setContentTableSettings(null);
    setContentSize(0);
    setDraftUpdatedAt(null);
    setDraftStatus('idle');

    try {
      const rawDraft = window.sessionStorage.getItem(draftStorageKey);
      if (!rawDraft) return;

      const parsedDraft = JSON.parse(rawDraft);
      if (!parsedDraft || typeof parsedDraft !== 'object') {
        window.sessionStorage.removeItem(draftStorageKey);
        return;
      }

      if (
        parsedDraft.updatedAt &&
        Date.now() - parsedDraft.updatedAt > DRAFT_TTL
      ) {
        window.sessionStorage.removeItem(draftStorageKey);
        return;
      }

      const restoredContent = parsedDraft.content ?? '';
      setTitle(parsedDraft.title ?? '');
      setContent(restoredContent);
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
      setContentTableSettings(
        hasContentTableSettings(parsedDraft.contentTableSettings)
          ? normalizeContentTableSettings(parsedDraft.contentTableSettings)
          : null,
      );
      setContentSize(calculateContentSize(restoredContent));
      setDraftUpdatedAt(parsedDraft.updatedAt ?? Date.now());
      setDraftStatus('loaded');
    } catch (error) {
      try {
        window.sessionStorage.removeItem(draftStorageKey);
      } catch {}
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[WritePostPage] 임시 저장본 불러오기 실패:', error);
      }
    }
  }, [authLoading, draftStorageKey]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      authLoading ||
      !draftStorageKey ||
      loadedDraftStorageKeyRef.current !== draftStorageKey
    ) {
      return undefined;
    }
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
      hasContentStyleSettings(contentStyleSettings) ||
      hasContentTableSettings(contentTableSettings);

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
          ...(hasContentTableSettings(contentTableSettings)
            ? { contentTableSettings: normalizeContentTableSettings(contentTableSettings) }
            : {}),
          updatedAt: Date.now(),
        };
        window.sessionStorage.setItem(
          draftStorageKey,
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
  }, [
    authLoading,
    category,
    clearDraftStorage,
    content,
    contentStyleSettings,
    contentTableSettings,
    draftStorageKey,
    isPublic,
    tags,
    title,
  ]);

  useQuillEditorBridge({
    quillRef,
    enabled: true,
    content,
    contentTableSettings,
    onPendingImage: handlePendingImage,
    onOpenFormulaEditor: handleOpenFormulaEditor,
    onContentChange: handleContentChange,
    onContentTableSettingsChange: setContentTableSettings,
  });

  const getCurrentEditorContent = useCallback(
    () => getReadyEditor()?.root?.innerHTML || content,
    [content, getReadyEditor],
  );

  const uploadPendingImages = useCallback(
    async ({ category: uploadCategory, postId, sourceContent = content } = {}) => {
      const resolvedCategory = uploadCategory || category;
      return replacePendingImages({
        content: sourceContent,
        pendingImages,
        category: resolvedCategory,
        postId,
        uploadImage: handleImageUpload,
      });
    },
    [category, content, handleImageUpload, pendingImages],
  );

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setCategory('study');
    setIsPublic(true);
    setTags([]);
    setContentStyleSettings(null);
    setContentTableSettings(null);
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
      let privateTransition = null;
      let persisted = false;
      let privatePathPrefixes = [];
      try {
        const docRef = doc(collection(db, category));
        privatePathPrefixes = [`post-images/${category}/${docRef.id}`];
        const editorContent = getCurrentEditorContent();
        const nextTableSettings =
          extractContentTableSettingsFromRoot(getReadyEditor()?.root) ||
          contentTableSettings;
        const normalizedTableSettings = hasContentTableSettings(nextTableSettings)
          ? normalizeContentTableSettings(nextTableSettings)
          : null;
        const uploadedContent = await uploadPendingImages({
          category,
          postId: docRef.id,
          sourceContent: editorContent,
        });
        let finalContent = sanitizeHtml(uploadedContent);
        if (!isPublic) {
          privateTransition = await preparePrivateImageContent({
            content: finalContent,
            storage,
            pathPrefixes: privatePathPrefixes,
          });
          finalContent = privateTransition.content;
          await deleteStorageObjects({
            urls: privateTransition.originalUrls,
            storage,
            pathPrefixes: privatePathPrefixes,
          });
        }
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
          ...(normalizedTableSettings ? { contentTableSettings: normalizedTableSettings } : {}),
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
        persisted = true;

        alert('게시글이 성공적으로 등록되었습니다!');
        resetForm();
        navigate(`/posts/${category}/${docRef.id}`);
      } catch (error) {
        if (privateTransition && !persisted) {
          try {
            await deleteStorageObjects({
              urls: privateTransition.privateUrls,
              storage,
              pathPrefixes: privatePathPrefixes,
            });
          } catch (cleanupError) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[WritePostPage] 비공개 이미지 복사본 정리 실패:', cleanupError);
            }
          }
        }
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
      contentTableSettings,
      getCurrentEditorContent,
      getReadyEditor,
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
        contentTableSettings,
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
        setContentTableSettings,
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
      contentTableSettings,
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
