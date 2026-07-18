import React from 'react';

function FullPageLoading() {
  return (
    <div
      className="app-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-loading-content">
        <div className="app-loading-mark" aria-hidden="true">
          <span className="app-loading-mark-ring" />
          <span className="app-loading-mark-core">LS</span>
        </div>
        <p className="app-loading-brand">LifeSculpture</p>
        <p className="app-loading-title">페이지를 불러오는 중입니다</p>
        <div className="app-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export default FullPageLoading;
