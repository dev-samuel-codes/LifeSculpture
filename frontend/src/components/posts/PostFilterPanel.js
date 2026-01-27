import React, { useEffect, useMemo, useState } from 'react';

const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();
const parseTags = (value) => {
  const unique = new Set();
  value
    .split(',')
    .map((tag) => normalizeText(tag))
    .filter(Boolean)
    .forEach((tag) => unique.add(tag));
  return Array.from(unique);
};
const serializeTags = (tags = []) => tags.map((tag) => normalizeText(tag)).filter(Boolean).join(', ');

function PostFilterPanel({
  sections = [],
  selectedParent,
  selectedChildren,
  visibleChildren,
  onToggleParent,
  onToggleChild,
  onClearAll,
  isAdmin = false,
  isFilterLoading = false,
  filterError = null,
  onUpdateSections,
}) {
  const sectionTitles = useMemo(
    () => (Array.isArray(sections) ? sections.map((section) => section.title) : []),
    [sections],
  );
  const [adminTarget, setAdminTarget] = useState('');
  const [parentTitleInput, setParentTitleInput] = useState('');
  const [parentTagsInput, setParentTagsInput] = useState('');
  const [newParentTitle, setNewParentTitle] = useState('');
  const [newParentTags, setNewParentTags] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(true);

  useEffect(() => {
    if (sectionTitles.length === 0) {
      setAdminTarget('');
      setParentTitleInput('');
      setParentTagsInput('');
      return;
    }
    if (!adminTarget || !sectionTitles.includes(adminTarget)) {
      setAdminTarget(sectionTitles[0]);
    }
  }, [adminTarget, sectionTitles]);

  useEffect(() => {
    if (!adminTarget) {
      setParentTitleInput('');
      setParentTagsInput('');
      return;
    }
    const targetSection = sections.find((section) => section.title === adminTarget);
    if (!targetSection) return;
    setParentTitleInput(targetSection.title);
    setParentTagsInput(serializeTags(targetSection.tags));
  }, [adminTarget, sections]);

  const runUpdate = async (nextSections) => {
    if (typeof onUpdateSections !== 'function') return { ok: false };
    setIsSaving(true);
    setAdminMessage('');
    try {
      const result = await onUpdateSections(nextSections);
      if (!result?.ok) {
        setAdminMessage('필터 저장에 실패했습니다.');
      } else {
        setAdminMessage('필터가 저장되었습니다.');
      }
      return result;
    } catch (error) {
      console.error('[PostFilterPanel] 필터 저장 실패:', error);
      setAdminMessage('필터 저장에 실패했습니다.');
      return { ok: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddParent = async () => {
    const title = normalizeText(newParentTitle);
    if (!title) {
      setAdminMessage('상위 필터 이름을 입력해주세요.');
      return;
    }
    if (sectionTitles.includes(title)) {
      setAdminMessage('이미 존재하는 상위 필터입니다.');
      return;
    }
    const tags = parseTags(newParentTags);
    const nextSections = [...sections, { title, tags }];
    const result = await runUpdate(nextSections);
    if (result?.ok) {
      setNewParentTitle('');
      setNewParentTags('');
      setAdminTarget(title);
    }
  };

  const handleSaveParent = async () => {
    if (!adminTarget) {
      setAdminMessage('수정할 상위 필터를 선택해주세요.');
      return;
    }
    const nextTitle = normalizeText(parentTitleInput);
    if (!nextTitle) {
      setAdminMessage('상위 필터 이름을 입력해주세요.');
      return;
    }
    const isDuplicate = sectionTitles.some(
      (title) => title === nextTitle && title !== adminTarget,
    );
    if (isDuplicate) {
      setAdminMessage('이미 존재하는 상위 필터 이름입니다.');
      return;
    }
    const tags = parseTags(parentTagsInput);
    const nextSections = sections.map((section) =>
      section.title === adminTarget ? { ...section, title: nextTitle, tags } : section,
    );
    const result = await runUpdate(nextSections);
    if (result?.ok) {
      setAdminTarget(nextTitle);
    }
  };

  const handleDeleteParent = async () => {
    if (!adminTarget) return;
    const confirmed = window.confirm(`"${adminTarget}" 상위 필터를 삭제할까요?`);
    if (!confirmed) return;
    const nextSections = sections.filter((section) => section.title !== adminTarget);
    const result = await runUpdate(nextSections);
    if (result?.ok) {
      setAdminTarget(nextSections[0]?.title || '');
    }
  };

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

      {isAdmin && (
        <div className="study-filter-section filter-admin-panel">
          <div className="filter-admin-header">
            <div className="study-filter-title">필터 관리</div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary filter-admin-toggle"
              onClick={() => setIsAdminOpen((prev) => !prev)}
            >
              {isAdminOpen ? '접기' : '펼치기'}
            </button>
          </div>
          {isAdminOpen && (
            <div className="filter-admin-body">
              <div className="filter-admin-group">
                <label className="filter-admin-label" htmlFor="filter-parent-select">
                  상위 필터 선택
                </label>
                <select
                  id="filter-parent-select"
                  className="form-select form-select-sm"
                  value={adminTarget}
                  onChange={(event) => setAdminTarget(event.target.value)}
                  disabled={isFilterLoading || isSaving || sectionTitles.length === 0}
                >
                  {sectionTitles.length === 0 && <option value="">등록된 필터가 없습니다</option>}
                  {sectionTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-admin-group">
                <label className="filter-admin-label" htmlFor="filter-parent-title">
                  상위 필터 이름
                </label>
                <input
                  id="filter-parent-title"
                  className="form-control form-control-sm"
                  value={parentTitleInput}
                  onChange={(event) => setParentTitleInput(event.target.value)}
                  disabled={isFilterLoading || isSaving || sectionTitles.length === 0}
                />
              </div>

              <div className="filter-admin-group">
                <label className="filter-admin-label" htmlFor="filter-parent-tags">
                  하위 필터 목록 (쉼표로 구분)
                </label>
                <textarea
                  id="filter-parent-tags"
                  className="form-control form-control-sm"
                  rows={3}
                  value={parentTagsInput}
                  onChange={(event) => setParentTagsInput(event.target.value)}
                  disabled={isFilterLoading || isSaving || sectionTitles.length === 0}
                />
              </div>

              <div className="filter-admin-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleSaveParent}
                  disabled={isFilterLoading || isSaving || sectionTitles.length === 0}
                >
                  변경 저장
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={handleDeleteParent}
                  disabled={isFilterLoading || isSaving || sectionTitles.length === 0}
                >
                  상위 필터 삭제
                </button>
              </div>

              <div className="filter-admin-divider" />

              <div className="filter-admin-group">
                <label className="filter-admin-label" htmlFor="filter-new-parent-title">
                  새 상위 필터
                </label>
                <input
                  id="filter-new-parent-title"
                  className="form-control form-control-sm"
                  value={newParentTitle}
                  onChange={(event) => setNewParentTitle(event.target.value)}
                  disabled={isFilterLoading || isSaving}
                  placeholder="상위 필터 이름"
                />
              </div>
              <div className="filter-admin-group">
                <label className="filter-admin-label" htmlFor="filter-new-parent-tags">
                  새 하위 필터 (쉼표로 구분)
                </label>
                <input
                  id="filter-new-parent-tags"
                  className="form-control form-control-sm"
                  value={newParentTags}
                  onChange={(event) => setNewParentTags(event.target.value)}
                  disabled={isFilterLoading || isSaving}
                  placeholder="예) React, Node.js"
                />
              </div>
              <div className="filter-admin-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={handleAddParent}
                  disabled={isFilterLoading || isSaving}
                >
                  상위 필터 추가
                </button>
              </div>

              {(adminMessage || filterError) && (
                <p className="filter-admin-message" role="status">
                  {adminMessage || filterError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default PostFilterPanel;
