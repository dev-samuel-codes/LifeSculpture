// src/pages/EditPostPage.js
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storage } from '../firebase/firebase';
import { AuthContext } from '../context/AuthContext';
import PostEditorForm from '../components/write/PostEditorForm';
import { useQuillToolbar } from '../components/text-editor/hooks/useQuillToolbar';
import useQuillEditorBridge from '../components/text-editor/hooks/useQuillEditorBridge';
import { MAX_EDITOR_CONTENT_SIZE } from '../components/text-editor/constants';
import {
  calculateContentSize,
  normalizeTableCellBreaksForEditor,
  sanitizeHtml,
} from '../components/text-editor/utils/content';
import {
  extractImageUrls,
  extractStoragePath,
  isSameStorageImage,
} from '../components/text-editor/utils/media';
import { replacePendingImages } from '../components/text-editor/utils/pendingImages';
import {
  hasContentStyleSettings,
  normalizeContentStyleSettings,
} from '../components/text-editor/utils/contentStyleSettings';
import {
  extractContentTableSettingsFromRoot,
  hasContentTableSettings,
  normalizeContentTableSettings,
} from '../components/text-editor/utils/contentTableSettings';
import useResponsiveEditorHeight from '../hooks/useResponsiveEditorHeight';
import { invalidatePostListCache } from '../hooks/usePostList';
import { deleteStorageImages, preparePrivateImageContent } from '../utils/storage';
import { cleanupPendingStorage } from '../services/postVisibilityTransition';
import {
  getPost,
  completePostMoveCleanupJob,
  movePostCategory,
  queueStorageCleanup,
  setPostVisibility,
  updatePostFields,
} from '../services/posts';
import { extractHashtagsFromContent, mergePostTags } from '../utils/tags';
import '../style/components/write/WritePostPage.css';
import '../style/components/editor/QuillToolbar.css';
import '../style/components/editor/CustomFormulaEditor.css';
import '../style/components/editor/RichText.css';

function EditPostPage() {
  const { category: categoryParam, id } = useParams();
  const navigate = useNavigate();
  const { uid, role } = useContext(AuthContext);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState([]);
  const [contentStyleSettings, setContentStyleSettings] = useState(null);
  const [contentTableSettings, setContentTableSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contentSize, setContentSize] = useState(0);
  const [pendingImages, setPendingImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [originalImageUrls, setOriginalImageUrls] = useState([]);
  const [originalIsPublic, setOriginalIsPublic] = useState(true);
  const [originalPendingStorageCleanup, setOriginalPendingStorageCleanup] = useState(null);
  const [originalStoragePathPrefixes, setOriginalStoragePathPrefixes] = useState([]);

  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);
  const [formulaInitialValue, setFormulaInitialValue] = useState('');
  const [onFormulaSave, setOnFormulaSave] = useState(null);

  const quillRef = useRef(null);
  const editorHeight = useResponsiveEditorHeight();
  const { modules, formats, handleImageUpload } = useQuillToolbar();

  const getReadyEditor = useCallback(() => {
    try {
      return quillRef.current?.getEditor?.() || null;
    } catch (error) {
      return null;
    }
  }, []);

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

  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    setContentSize(calculateContentSize(newContent));
  }, []);

  const handlePendingImage = useCallback(({ file, tempUrl }) => {
    setPendingImages((prev) => [...prev, { id: Date.now(), file, tempUrl }]);
  }, []);

  const handleOpenFormulaEditor = useCallback((initialValue, onSaveCallback) => {
    setFormulaInitialValue(initialValue);
    setOnFormulaSave(() => onSaveCallback);
    setIsFormulaEditorOpen(true);
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postData = await getPost({ category: categoryParam, id });
        if (postData) {
          const initialContent = normalizeTableCellBreaksForEditor(postData.content || '');
          setTitle(postData.title || '');
          setContent(initialContent);
          setCategory(postData.category || categoryParam);
          const initialIsPublic = typeof postData.isPublic === 'boolean' ? postData.isPublic : true;
          setIsPublic(initialIsPublic);
          setOriginalIsPublic(initialIsPublic);
          setOriginalPendingStorageCleanup(postData.pendingStorageCleanup || null);
          setOriginalStoragePathPrefixes(
            Array.isArray(postData.storagePathPrefixes) ? postData.storagePathPrefixes : [],
          );
          setTags(Array.isArray(postData.tags) ? postData.tags : []);
          setContentStyleSettings(
            hasContentStyleSettings(postData.contentStyleSettings)
              ? normalizeContentStyleSettings(postData.contentStyleSettings)
              : null,
          );
          setContentTableSettings(
            hasContentTableSettings(postData.contentTableSettings)
              ? normalizeContentTableSettings(postData.contentTableSettings)
              : null,
          );
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

  useQuillEditorBridge({
    quillRef,
    enabled: !loading,
    content,
    contentTableSettings,
    onPendingImage: handlePendingImage,
    onOpenFormulaEditor: handleOpenFormulaEditor,
    onContentChange: handleContentChange,
    onContentTableSettingsChange: setContentTableSettings,
  });

  useEffect(() => {
    if (!quillRef.current) return;
    const editor = getReadyEditor();
    if (!editor) return;
    const codeBlocks = editor.root.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
      block.style.whiteSpace = 'pre';
      block.style.overflowX = 'auto';
      block.style.maxWidth = '800px';
      block.style.margin = '1.75rem auto';
    });
  }, [content, getReadyEditor]);

  const getCurrentEditorContent = useCallback(
    () => getReadyEditor()?.root?.innerHTML || content,
    [content, getReadyEditor],
  );

  const uploadPendingImages = useCallback(
    async (sourceContent = content, onUploaded) => {
      const resolvedCategory = category.trim() || categoryParam;
      return replacePendingImages({
        content: sourceContent,
        pendingImages,
        category: resolvedCategory,
        postId: id,
        uploadImage: handleImageUpload,
        onUploaded,
      });
    },
    [category, categoryParam, content, handleImageUpload, id, pendingImages],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !sanitizeHtml(content)) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    if (contentSize > MAX_EDITOR_CONTENT_SIZE) {
      alert(`콘텐츠가 너무 깁니다. 최대: ${MAX_EDITOR_CONTENT_SIZE / 1024}KB`);
      return;
    }

    const nextCategory = category.trim();
    if (!nextCategory) {
      alert('카테고리를 선택해주세요.');
      return;
    }
    if (nextCategory !== categoryParam && originalIsPublic && !isPublic) {
      alert('카테고리 이동과 비공개 전환은 한 번에 처리할 수 없습니다. 먼저 이동한 뒤 비공개로 전환해주세요.');
      return;
    }
    const sourcePathPrefix = `post-images/${categoryParam}/${id}`;
    const targetPathPrefix = `post-images/${nextCategory}/${id}`;
    const sourcePathPrefixes = [...new Set([
      sourcePathPrefix,
      ...originalStoragePathPrefixes,
    ])];

    setIsUploading(true);
    let privateTransition = null;
    let persisted = false;
    const uploadedImageUrls = [];
    const orphanCleanupJobId = `edit--${categoryParam}--${id}--${Date.now()}`;
    try {
      const editorContent = getCurrentEditorContent();
      const nextTableSettings =
        extractContentTableSettingsFromRoot(getReadyEditor()?.root) ||
        contentTableSettings;
      const normalizedTableSettings = hasContentTableSettings(nextTableSettings)
        ? normalizeContentTableSettings(nextTableSettings)
        : null;
      const finalContent = await uploadPendingImages(
        editorContent,
        (url) => uploadedImageUrls.push(url),
      );
      const currentUrls = getTrackedImageUrls(finalContent).filter((url) => url.startsWith('https'));
      const originalUrls = originalImageUrls.filter((url) => url.startsWith('https'));
      const removedUrls = originalUrls.filter((url) => {
        const path = extractStoragePath(url);
        return sourcePathPrefixes.some((prefix) => path?.startsWith(`${prefix}/`)) &&
          !currentUrls.some((candidate) => isSameStorageImage(url, candidate));
      });

      let sanitizedContent = sanitizeHtml(finalContent);
      const nextTags = mergePostTags(tags, extractHashtagsFromContent(sanitizedContent));
      const normalizedStyleSettings = hasContentStyleSettings(contentStyleSettings)
        ? normalizeContentStyleSettings(contentStyleSettings)
        : null;

      await cleanupPendingStorage({
        category: categoryParam,
        id,
        pendingStorageCleanup: originalPendingStorageCleanup,
        storage,
        uid,
        role,
      });

      const shouldDeleteRemoved = removedUrls.length > 0 &&
        window.confirm(`${removedUrls.length}개의 이미지를 삭제하시겠습니까?`);

      if (nextCategory === categoryParam && originalIsPublic && !isPublic) {
        privateTransition = await preparePrivateImageContent({
          content: sanitizedContent,
          storage,
          pathPrefixes: sourcePathPrefixes,
        });
        sanitizedContent = privateTransition.content;
      }

      const cleanupUrls = [...new Set([
        ...(privateTransition?.originalUrls || []),
        ...(shouldDeleteRemoved ? removedUrls : []),
      ])];
      const pendingStorageCleanup = cleanupUrls.length > 0
        ? { urls: cleanupUrls, pathPrefixes: sourcePathPrefixes }
        : null;
      const storagePathPrefixes = nextCategory === categoryParam
        ? sourcePathPrefixes
        : [...new Set([...sourcePathPrefixes, targetPathPrefix])];

      if (nextCategory === categoryParam) {
        await updatePostFields({
          category: categoryParam,
          id,
          data: {
            title: title.trim(),
            content: sanitizedContent,
            category: nextCategory,
            isPublic,
            pendingStorageCleanup,
            storagePathPrefixes,
            tags: nextTags,
            ...(normalizedStyleSettings ? { contentStyleSettings: normalizedStyleSettings } : {}),
            ...(normalizedTableSettings ? { contentTableSettings: normalizedTableSettings } : {}),
          },
        });
      } else {
        await movePostCategory({
          fromCategory: categoryParam,
          toCategory: nextCategory,
          id,
          data: {
            title: title.trim(),
            content: sanitizedContent,
            isPublic,
            pendingStorageCleanup,
            storagePathPrefixes,
            tags: nextTags,
            ...(normalizedStyleSettings ? { contentStyleSettings: normalizedStyleSettings } : {}),
            ...(normalizedTableSettings ? { contentTableSettings: normalizedTableSettings } : {}),
          },
          preparedStorageCleanup: {
            urls: uploadedImageUrls,
            pathPrefixes: [targetPathPrefix],
          },
        });
      }
      persisted = true;

      if (cleanupUrls.length > 0) {
        try {
          await deleteStorageImages({
            urls: cleanupUrls,
            storage,
            uid,
            role,
            pathPrefixes: sourcePathPrefixes,
          });
          await updatePostFields({
            category: nextCategory,
            id,
            data: { pendingStorageCleanup: null },
          });
        } catch (cleanupError) {
          if (privateTransition && originalIsPublic && !isPublic) {
            await setPostVisibility({
              category: nextCategory,
              id,
              isPublic: true,
              content: privateTransition.content,
            });
          }
          throw cleanupError;
        }
      }

      invalidatePostListCache([categoryParam, nextCategory]);

      alert('게시글이 성공적으로 수정되었습니다.');
      const targetPath = `/posts/${nextCategory}/${id}`;
      if (window.opener) {
        window.opener.location.href = targetPath;
        window.close();
      } else {
        navigate(targetPath, { replace: true });
      }
    } catch (err) {
      const mayCleanPreparedImages = !persisted &&
        (!err.preservePreparedImages || err.moveRolledBack);
      const preparedCleanupUrls = mayCleanPreparedImages
        ? [...new Set([
          ...(privateTransition?.privateUrls || []),
          ...uploadedImageUrls,
        ])]
        : [];
      if (preparedCleanupUrls.length > 0) {
        try {
          await deleteStorageImages({
            urls: preparedCleanupUrls,
            storage,
            uid,
            role,
          });
          if (err.moveJobId) {
            await completePostMoveCleanupJob({ jobId: err.moveJobId });
          }
        } catch (cleanupError) {
          if (!err.moveJobId) {
            try {
              await queueStorageCleanup({
                jobId: orphanCleanupJobId,
                category: categoryParam,
                id,
                storageCleanup: {
                  urls: preparedCleanupUrls,
                  pathPrefixes: [...new Set([sourcePathPrefix, targetPathPrefix])],
                },
              });
            } catch (ledgerError) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('이미지 정리 작업 원장 저장 실패:', ledgerError);
              }
            }
          }
          if (process.env.NODE_ENV !== 'production') {
            console.warn('준비 이미지 정리 실패:', cleanupError);
          }
        }
      }
      alert(`수정 실패: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="container mt-4">Loading...</div>;
  if (error) return <div className="container mt-4 text-danger">Error: {error}</div>;

  return (
    <PostEditorForm
      mode="edit"
      title={title}
      content={content}
      category={category}
      isPublic={isPublic}
      tags={tags}
      contentStyleSettings={contentStyleSettings}
      editorHeight={editorHeight}
      isSubmitting={isUploading}
      statusMessage=""
      quillRef={quillRef}
      modules={modules}
      formats={formats}
      onTitleChange={setTitle}
      onContentChange={handleContentChange}
      onCategoryChange={setCategory}
      onPublicChange={setIsPublic}
      onTagsChange={setTags}
      onContentStyleSettingsChange={setContentStyleSettings}
      onSubmit={handleSubmit}
      formulaDialog={{
        isOpen: isFormulaEditorOpen,
        onClose: () => setIsFormulaEditorOpen(false),
        onSave: (latex) => {
          if (typeof onFormulaSave === 'function') onFormulaSave(latex);
          setIsFormulaEditorOpen(false);
        },
        initialValue: formulaInitialValue,
      }}
    />
  );
}

export default EditPostPage;
