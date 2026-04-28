import React, { useCallback } from 'react';

function PostListItem({ post, role, formatDate, onSelectPost }) {
  const isPrivate = post.isPublic === false;

  const handleClick = useCallback(() => {
    onSelectPost(post.id);
  }, [onSelectPost, post.id]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectPost(post.id);
      }
    },
    [onSelectPost, post.id],
  );

  return (
    <div className="col-12 mb-3">
      <div
        className="card clickable-card"
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${post.title} 게시물 보기`}
      >
        <div className="card-body card-row">
          <div className="card-left">
            <div className="clickable-card-content">
              <h5 className="card-title">
                {post.title}
                {role === 'admin' && (
                  <span
                    className={`post-visibility-label ${isPrivate ? 'is-private' : 'is-public'}`}
                    aria-label={`게시물 ${isPrivate ? '비공개' : '공개'} 상태`}
                  >
                    {isPrivate ? '(비공개)' : '(공개)'}
                  </span>
                )}
              </h5>
              <div className="card-tags"></div>
            </div>
          </div>
          <div className="card-right">
            <div className="meta-info">
              <div className="meta-date">{formatDate(post.createdAt)}</div>
              <div className="meta-views">Views: {post.viewCount || 0}</div>
            </div>
            <div className="like-section">
              <div className="heart-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <span className="like-count">{post.likeCount || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostListItem;
