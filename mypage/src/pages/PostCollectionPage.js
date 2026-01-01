import React, { useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { formatDate } from '../utils/date';
import PostFilterPanel from '../components/posts/PostFilterPanel';
import PostListToolbar from '../components/posts/PostListToolbar';
import PostList from '../components/posts/PostList';
import PostPagination from '../components/posts/PostPagination';
import usePostList from '../hooks/usePostList';
import '../style/pages/study/Study.css';

function PostCollectionPage({ config }) {
  const { collectionName, sections = [], emptyMessage } = config;
  const { role } = useContext(AuthContext);
  const navigate = useNavigate();

  const {
    loading,
    error,
    searchText,
    sortKey,
    selectedParent,
    selectedChildren,
    visibleChildren,
    currentPage,
    totalPages,
    filteredCount,
    currentPosts,
    handleSearchChange,
    handleSortChange,
    toggleParent,
    toggleChild,
    clearAll,
    goToPage,
    goToPrevious,
    goToNext,
  } = usePostList({
    collectionName,
    sections,
    role,
  });

  const handleSelectPost = useCallback(
    (postId) => {
      navigate(`/posts/${collectionName}/${postId}`);
    },
    [collectionName, navigate],
  );

  const emptyListMessage = useMemo(() => emptyMessage || '게시물을 찾을 수 없습니다.', [emptyMessage]);

  if (loading) return <div className="container mt-4" />;
  if (error) return <div className="container mt-4 text-danger">Error: {error}</div>;

  return (
    <div className="container mt-4">
      <div className="row g-4">
        <div className="col-md-3">
          <PostFilterPanel
            sections={sections}
            selectedParent={selectedParent}
            selectedChildren={selectedChildren}
            visibleChildren={visibleChildren}
            onToggleParent={toggleParent}
            onToggleChild={toggleChild}
            onClearAll={clearAll}
          />
        </div>

        <div className="col-md-9">
          <PostListToolbar
            searchText={searchText}
            onSearchChange={handleSearchChange}
            sortKey={sortKey}
            onSortChange={handleSortChange}
            totalCount={filteredCount}
          />

          <PostList
            posts={currentPosts}
            role={role}
            formatDate={formatDate}
            onSelectPost={handleSelectPost}
            emptyMessage={emptyListMessage}
          />

          <PostPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevious={goToPrevious}
            onNext={goToNext}
            onSelect={goToPage}
          />
        </div>
      </div>
    </div>
  );
}

export function createPostCollectionPage(config) {
  function WrappedPostCollectionPage() {
    return <PostCollectionPage config={config} />;
  }

  WrappedPostCollectionPage.displayName = `PostCollectionPage(${config?.collectionName || 'unknown'})`;
  return WrappedPostCollectionPage;
}

export default PostCollectionPage;
