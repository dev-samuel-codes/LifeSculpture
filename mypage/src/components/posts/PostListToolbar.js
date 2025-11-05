import React from 'react';

function PostListToolbar({ searchText, onSearchChange, sortKey, onSortChange, totalCount }) {
  return (
    <div className="d-flex flex-wrap gap-2 align-items-center mb-3 study-toolbar">
      <input
        className="form-control"
        style={{ maxWidth: 360 }}
        placeholder="검색어를 입력하세요 (제목에 포함)"
        value={searchText}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <select
        className="form-select"
        style={{ maxWidth: 200 }}
        value={sortKey}
        onChange={(event) => onSortChange(event.target.value)}
      >
        <option value="createdAt_desc">최신순</option>
        <option value="views_desc">조회수순</option>
        <option value="title_asc">제목 A→Z</option>
      </select>
      <div className="ms-auto small text-muted">총 {totalCount}개 결과</div>
    </div>
  );
}

export default PostListToolbar;
