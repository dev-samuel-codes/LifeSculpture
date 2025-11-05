import React from 'react';

function PostFilterPanel({
  sections,
  selectedParent,
  selectedChildren,
  visibleChildren,
  onToggleParent,
  onToggleChild,
  onClearAll,
}) {
  return (
    <>
      <div className="mb-2">
        <button className="btn btn-sm btn-outline-secondary btn-all-posts" onClick={onClearAll}>
          전체 게시물
        </button>
      </div>

      <div className="study-filter-section mb-3">
        <div className="study-filter-title">상위 필터</div>
        <div className="d-flex flex-wrap gap-2">
          {sections.map((section) => {
            const active = selectedParent === section.title;
            return (
              <button
                key={section.title}
                type="button"
                className={`parent-chip ${active ? 'active' : ''}`}
                onClick={() => onToggleParent(section.title)}
              >
                {section.title}
              </button>
            );
          })}
        </div>
      </div>

      {selectedParent && (
        <div className="study-filter-section mb-3">
          <div className="study-filter-title">하위 필터</div>
          <div className="d-flex flex-wrap gap-2">
            {visibleChildren.map((tag) => {
              const active = selectedChildren.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`child-chip ${active ? 'active' : ''}`}
                  onClick={() => onToggleChild(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default PostFilterPanel;
