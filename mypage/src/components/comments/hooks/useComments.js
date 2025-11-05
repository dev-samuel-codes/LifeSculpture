// useComments 훅: 댓글 데이터 조회와 상호작용 로직을 관리
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createComment,
  DEFAULT_PAGE_SIZE,
  deleteCommentTree,
  fetchCommentsPage,
  fetchLikeCount,
  fetchReplyCount,
  hasUserLiked,
  likeComment,
  unlikeComment,
} from '../../../services/comments';
import { AuthContext } from '../../../context/AuthContext';
import { ANONYMOUS_NAME } from '../utils';

const buildViewerMeta = async (category, postId, commentId, uid) => {
  const [likeCount, viewerHasLiked, replyCount] = await Promise.all([
    fetchLikeCount({ category, postId, commentId }).catch(() => 0),
    uid ? hasUserLiked({ category, postId, commentId, uid }).catch(() => false) : false,
    fetchReplyCount({ category, postId, commentId }).catch(() => 0),
  ]);
  return { likeCount, viewerHasLiked, replyCount };
};

const hydrateComment = async (raw, category, postId, uid) => {
  if (!raw) return null;
  const meta = await buildViewerMeta(category, postId, raw.id, uid);
  return {
    ...raw,
    ...meta,
    replies: [],
    repliesCursor: null,
    repliesLoading: false,
    repliesHasMore: false,
    showReplies: false,
  };
};

const useComments = ({ category, postId }) => {
  const auth = useContext(AuthContext);
  const currentUser = useMemo(
    () => ({
      isAuthenticated: auth?.isAuthenticated ?? false,
      uid: auth?.uid ?? null,
      name: auth?.userName || ANONYMOUS_NAME,
      photo: auth?.userPicture ?? null,
      role: auth?.role ?? null,
    }),
    [auth?.isAuthenticated, auth?.role, auth?.uid, auth?.userName, auth?.userPicture],
  );

  const [rootComments, setRootComments] = useState([]);
  const [rootCursor, setRootCursor] = useState(null);
  const [hasMoreRoot, setHasMoreRoot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  const lastCommentRef = useRef(0);

  const requestLogin = useCallback(() => setShowLoginPopup(true), []);
  const closeLoginPopup = useCallback(() => setShowLoginPopup(false), []);

  const fetchRootComments = useCallback(
    async ({ reset } = { reset: false }) => {
      if (!category || !postId) {
        setLoading(false);
        return;
      }

      if (reset) {
        setLoading(true);
      } else {
        if (!hasMoreRoot || loadingMore) return;
        setLoadingMore(true);
      }

      try {
        const { comments, cursor, hasMore } = await fetchCommentsPage({
          category,
          postId,
          parentId: null,
          pageSize: DEFAULT_PAGE_SIZE,
          order: 'desc',
          cursor: reset ? null : rootCursor,
        });
        const hydrated = await Promise.all(
          comments.map((comment) => hydrateComment(comment, category, postId, currentUser.uid)),
        );
        setRootComments((prev) => (reset ? hydrated : [...prev, ...hydrated]));
        setRootCursor(cursor);
        setHasMoreRoot(hasMore);
        setError(null);
      } catch (fetchError) {
        console.error('[Comments] Failed to load comments:', fetchError);
        setError('댓글을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, currentUser.uid, hasMoreRoot, loadingMore, postId, rootCursor],
  );

  useEffect(() => {
    if (!category || !postId) return;
    setRootComments([]);
    setRootCursor(null);
    setHasMoreRoot(false);
    fetchRootComments({ reset: true });
  }, [category, fetchRootComments, postId]);

  const appendRootComment = useCallback(
    (comment) => setRootComments((prev) => [comment, ...prev]),
    [],
  );

  const replaceCommentInLists = useCallback((id, updater) => {
    setRootComments((prev) =>
      prev.map((item) => {
        if (item.id === id) return updater(item);
        return {
          ...item,
          replies: item.replies.map((reply) => (reply.id === id ? updater(reply) : reply)),
        };
      }),
    );
  }, []);

  const handleSubmitRootComment = useCallback(
    async (content) => {
      if (!currentUser.isAuthenticated) {
        requestLogin();
        return;
      }

      const now = Date.now();
      if (now - lastCommentRef.current < 2000) {
        alert('너무 자주 댓글을 작성할 수 없습니다.');
        return;
      }
      lastCommentRef.current = now;

      const optimisticId = `temp-${now}`;
      const optimistic = {
        id: optimisticId,
        authorId: currentUser.uid,
        authorName: currentUser.name,
        authorPhoto: currentUser.photo,
        content,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        likeCount: 0,
        viewerHasLiked: false,
        replyCount: 0,
        replies: [],
        repliesCursor: null,
        repliesLoading: false,
        repliesHasMore: false,
        showReplies: false,
        isOptimistic: true,
      };

      appendRootComment(optimistic);
      try {
        const created = await createComment({
          category,
          postId,
          content,
          parentId: null,
          authorId: currentUser.uid,
          authorName: currentUser.name,
          authorPhoto: currentUser.photo,
        });
        const hydrated = await hydrateComment(created, category, postId, currentUser.uid);
        replaceCommentInLists(optimisticId, () => hydrated);
      } catch (submitError) {
        console.error('[Comments] Failed to create comment:', submitError);
        setRootComments((prev) => prev.filter((item) => item.id !== optimisticId));
        alert('댓글 작성에 실패했습니다.');
      }
    },
    [appendRootComment, category, currentUser, postId, replaceCommentInLists, requestLogin],
  );

  const handleToggleLike = useCallback(
    async (target) => {
      if (!currentUser.isAuthenticated) {
        requestLogin();
        return;
      }

      const isReply = !!target.parentId;
      const parentId = target.parentId;
      const adjust = (delta, liked) => {
        setRootComments((prev) =>
          prev.map((item) => {
            if (!isReply && item.id === target.id) {
              return {
                ...item,
                likeCount: Math.max(item.likeCount + delta, 0),
                viewerHasLiked: liked,
              };
            }
            if (isReply && item.id === parentId) {
              return {
                ...item,
                replies: item.replies.map((reply) =>
                  reply.id === target.id
                    ? { ...reply, likeCount: Math.max(reply.likeCount + delta, 0), viewerHasLiked: liked }
                    : reply,
                ),
              };
            }
            return item;
          }),
        );
      };

      const wasLiked = target.viewerHasLiked;
      adjust(wasLiked ? -1 : 1, !wasLiked);

      try {
        if (wasLiked) {
          await unlikeComment({ category, postId, commentId: target.id, uid: currentUser.uid });
        } else {
          await likeComment({ category, postId, commentId: target.id, uid: currentUser.uid });
        }
      } catch (err) {
        console.error('[Comments] Failed to toggle like:', err);
        adjust(wasLiked ? 1 : -1, wasLiked);
        alert('좋아요 처리에 실패했습니다.');
      }
    },
    [category, currentUser.uid, currentUser.isAuthenticated, postId, requestLogin],
  );

  const handleDeleteComment = useCallback(
    async (comment) => {
      if (!window.confirm('이 댓글을 정말 삭제하시겠습니까?')) return;
      const isReply = !!comment.parentId;
      const parentId = comment.parentId;

      const previous = rootComments;
      if (isReply) {
        setRootComments((prev) =>
          prev.map((item) =>
            item.id === parentId
              ? {
                  ...item,
                  replies: item.replies.filter((reply) => reply.id !== comment.id),
                  replyCount: Math.max(item.replyCount - 1, 0),
                }
              : item,
          ),
        );
      } else {
        setRootComments((prev) => prev.filter((item) => item.id !== comment.id));
      }

      try {
        await deleteCommentTree({ category, postId, commentId: comment.id });
      } catch (err) {
        console.error('[Comments] Failed to delete comment:', err);
        setRootComments(previous);
        alert('댓글 삭제에 실패했습니다.');
      }
    },
    [category, postId, rootComments],
  );

  return {
    currentUser,
    comments: rootComments,
    loading,
    loadingMore,
    error,
    hasMore: hasMoreRoot,
    loadMore: () => fetchRootComments({ reset: false }),
    submitComment: handleSubmitRootComment,
    toggleLike: handleToggleLike,
    deleteComment: handleDeleteComment,
    isLoginPopupOpen: showLoginPopup,
    requestLogin,
    closeLoginPopup,
  };
};

export default useComments;
