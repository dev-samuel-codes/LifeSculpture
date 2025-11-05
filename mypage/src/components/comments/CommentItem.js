import React from 'react';
import { ANONYMOUS_NAME } from './utils';
import { formatDateOnly } from '../../utils/date';

function CommentItem({ comment, depth, onToggleLike, onDeleteComment, currentUser }) {
  const canDelete =
    currentUser.isAuthenticated &&
    (currentUser.uid === comment.authorId ||
      currentUser.role === 'admin' ||
      (depth === 1 && currentUser.uid === comment.parentAuthorId));

  return (
    <div className={`comment-item depth-${depth}`}>
      <div className="comment-meta">
        <div className="comment-author">
          {comment.authorPhoto && (
            <img
              className="comment-avatar"
              src={comment.authorPhoto}
              alt={comment.authorName || ANONYMOUS_NAME}
            />
          )}
          <span className="comment-author-name">{comment.authorName || ANONYMOUS_NAME}</span>
        </div>
        <span className="comment-date">{formatDateOnly(comment.createdAt)}</span>
      </div>
      <div className="comment-body">
        <pre className="comment-content">{comment.content}</pre>
      </div>
      <div className="comment-toolbar">
        <button
          type="button"
          className={`comment-like-button ${comment.viewerHasLiked ? 'active' : ''}`}
          onClick={() => onToggleLike(comment)}
        >
          좋아요 {comment.likeCount}
        </button>
        {canDelete && (
          <button
            type="button"
            className="comment-action-button"
            onClick={() => onDeleteComment(comment)}
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

export default CommentItem;
