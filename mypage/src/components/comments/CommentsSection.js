// CommentsSection 컴포넌트: 댓글 목록과 작성 UI 전체를 구성
import React from 'react';
import LoginRequiredPopup from '../auth/LoginRequiredPopup';
import CommentComposer from './CommentComposer';
import CommentItem from './CommentItem';
import useComments from './hooks/useComments';
import '../../style/Comments.css';

const CommentsSection = ({ category, postId }) => {
  const {
    currentUser,
    comments,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    submitComment,
    toggleLike,
    deleteComment,
    isLoginPopupOpen,
    closeLoginPopup,
  } = useComments({ category, postId });

  return (
    <section className="comments-section">
      <header className="comments-header">
        <div className="comments-title-group">
          <h2 className="comments-title">댓글</h2>
          <span className="comments-count">총 {comments.length}개</span>
        </div>
      </header>

      <CommentComposer
        placeholder={
          currentUser.isAuthenticated ? '내용을 입력하세요.' : '로그인 후 댓글을 작성할 수 있습니다.'
        }
        onSubmit={submitComment}
        disabled={!currentUser.isAuthenticated}
        maxLength={2000}
      />

      {error && <div className="comments-error">{error}</div>}
      {loading && <div className="comments-loading">댓글을 불러오는 중...</div>}

      <div className="comments-list">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            depth={0}
            onToggleLike={toggleLike}
            onDeleteComment={deleteComment}
            currentUser={currentUser}
          />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          className="comment-action-button link load-more"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? '불러오는 중...' : '더 보기'}
        </button>
      )}

      <LoginRequiredPopup isOpen={isLoginPopupOpen} onClose={closeLoginPopup} />
    </section>
  );
};

export default CommentsSection;
