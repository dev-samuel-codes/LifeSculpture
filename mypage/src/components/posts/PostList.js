import React from 'react';
import PostListItem from './PostListItem';

function PostList({ posts, role, formatDate, onSelectPost, emptyMessage = '게시물을 찾을 수 없습니다.' }) {
  if (posts.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <div className="row">
      {posts.map((post) => (
        <PostListItem
          key={post.id}
          post={post}
          role={role}
          formatDate={formatDate}
          onSelectPost={onSelectPost}
        />
      ))}
    </div>
  );
}

export default PostList;
