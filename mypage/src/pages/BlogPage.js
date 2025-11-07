import React, { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { formatDate } from '../utils/date';
import { PostFilterPanel, PostListToolbar, PostList, PostPagination } from '../components';
import usePostList from '../hooks/usePostList';
import '../style/pages/study/Study.css';

const BLOG_SECTIONS = [
  { title: '에세이 · 일상', tags: ['일상', '생각', '회고', '일기'] },
  { title: '여행', tags: ['여행', '국내여행', '해외여행', '일정', '후기'] },
  { title: '사진', tags: ['사진', '포토', '촬영', '카메라'] },
  { title: '튜토리얼 · 팁', tags: ['팁', '가이드', '튜토리얼', '노하우', '설정'] },
  { title: '리뷰', tags: ['리뷰', '사용기', '언박싱'] },
  { title: '개발 블로그', tags: ['개발', 'React', 'Next.js', 'Node', 'Firebase'] },
];

function BlogPage() {
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
    collectionName: 'blog',
    sections: BLOG_SECTIONS,
    role,
  });

  const handleSelectPost = useCallback(
    (postId) => {
      navigate(`/posts/blog/${postId}`);
    },
    [navigate],
  );

  if (loading) return <div className="container mt-4"></div>;
  if (error) return <div className="container mt-4 text-danger">Error: {error}</div>;

  return (
    <div className="container mt-4">
      <div className="row g-4">
        <div className="col-md-3">
          <PostFilterPanel
            sections={BLOG_SECTIONS}
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

export default BlogPage;
