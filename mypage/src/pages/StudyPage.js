import React, { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { formatDate } from '../utils/date';
import { PostFilterPanel, PostListToolbar, PostList, PostPagination } from '../components';
import usePostList from '../hooks/usePostList';
import '../style/pages/study/Study.css';

const TAG_SECTIONS = [
  {
    title: '개발 · IT',
    tags: [
      'Frontend',
      'React',
      'Next.js',
      'Vue',
      'Angular',
      'Backend',
      'Node.js',
      'Express',
      'Django',
      'Spring',
      'Database',
      'Firebase',
      'MySQL',
      'MongoDB',
      'Git',
      'Docker',
      'DevOps',
    ],
  },
  { title: '과학', tags: ['물리학', '화학', '생물학', '지구과학', '천문학'] },
  { title: '수학', tags: ['기초수학', '대수학', '기하학', '미적분', '확률과 통계', '논리'] },
  { title: '인문 · 사회', tags: ['역사', '철학', '심리학', '사회학', '정치', '경제'] },
  { title: '프로젝트', tags: ['일기 앱'] },
];

function StudyPage() {
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
    collectionName: 'study',
    sections: TAG_SECTIONS,
    role,
  });

  const handleSelectPost = useCallback(
    (postId) => {
      navigate(`/posts/study/${postId}`);
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
            sections={TAG_SECTIONS}
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

export default StudyPage;
