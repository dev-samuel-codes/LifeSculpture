import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';
import TextEditorFormulaDialog from '../text-editor/TextEditorFormulaDialog';
import TextEditorStyleDialog from '../text-editor/TextEditorStyleDialog';
import { registerTextEditorImageBlot } from '../text-editor/TextEditorCustomBlots';
import { getContentStyleCssVariables } from '../text-editor/utils/contentStyleSettings';
import { normalizeTag } from '../../utils/tags';

registerTextEditorImageBlot();

const CATEGORY_OPTIONS = [
  { value: 'study', label: 'Study' },
  { value: 'blog', label: 'Blog' },
];

const splitTagInput = (value) =>
  String(value || '')
    .split(',')
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean);

function TagInput({ tags, onChange }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const addTags = (rawValue) => {
    const nextTags = splitTagInput(rawValue);
    if (nextTags.length === 0) return;

    const existing = new Set(tags.map((tag) => normalizeTag(tag)));
    const merged = [...tags];
    nextTags.forEach((tag) => {
      const normalized = normalizeTag(tag);
      if (!normalized || existing.has(normalized)) return;
      existing.add(normalized);
      merged.push(tag);
    });
    onChange(merged);
    setInputValue('');
  };

  const removeTag = (targetIndex) => {
    onChange(tags.filter((_, index) => index !== targetIndex));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTags(inputValue);
      return;
    }

    if (event.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleBlur = () => {
    addTags(inputValue);
  };

  const handlePaste = (event) => {
    const text = event.clipboardData?.getData('text');
    if (!text || !text.includes(',')) return;
    event.preventDefault();
    addTags(text);
  };

  return (
    <div className="writing-tag-input" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, index) => (
        <span className="writing-tag-chip" key={`${tag}-${index}`}>
          #{tag}
          <button
            type="button"
            className="writing-tag-remove"
            onClick={(event) => {
              event.stopPropagation();
              removeTag(index);
            }}
            aria-label={`${tag} 태그 삭제`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id="tagInput"
        type="text"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPaste={handlePaste}
        aria-label="태그"
        placeholder={tags.length > 0 ? '' : '쉼표 또는 Enter로 추가'}
      />
    </div>
  );
}

function PostEditorForm({
  mode,
  title,
  content,
  category,
  isPublic,
  tags,
  contentStyleSettings,
  editorHeight,
  isSubmitting,
  statusMessage,
  quillRef,
  modules,
  formats,
  formulaDialog,
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onPublicChange,
  onTagsChange,
  onContentStyleSettingsChange,
  onSubmit,
}) {
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const contentStyleVariables = useMemo(
    () => getContentStyleCssVariables(contentStyleSettings),
    [contentStyleSettings],
  );
  const openStyleDialog = useCallback(() => {
    setIsStyleDialogOpen(true);
  }, []);
  const closeStyleDialog = useCallback(() => {
    setIsStyleDialogOpen(false);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    document.documentElement.classList.add('writing-page-lock-scroll');
    document.body.classList.add('writing-page-lock-scroll');

    return () => {
      document.documentElement.classList.remove('writing-page-lock-scroll');
      document.body.classList.remove('writing-page-lock-scroll');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let cleanupItem = null;
    let retryTimer = null;
    let frameId = null;

    const installStyleSettingsItem = () => {
      const editor = quillRef.current?.getEditor?.();
      const toolbar = editor?.getModule?.('toolbar')?.container;
      const headerPicker = toolbar?.querySelector?.('.ql-picker.ql-header');
      const options = headerPicker?.querySelector?.('.ql-picker-options');

      if (!headerPicker || !options) {
        return false;
      }

      let item = options.querySelector('[data-style-settings-trigger="true"]');
      if (!item) {
        item = document.createElement('span');
        item.className = 'ql-picker-item ql-style-settings-item';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', '스타일 수정');
        item.dataset.styleSettingsTrigger = 'true';
        options.appendChild(item);
      }

      const closePicker = () => {
        headerPicker.classList.remove('ql-expanded');
        headerPicker.querySelector('.ql-picker-label')?.setAttribute('aria-expanded', 'false');
      };

      const handleOpen = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        closePicker();
        openStyleDialog();
      };

      const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          handleOpen(event);
        }
      };

      item.addEventListener('mousedown', handleOpen);
      item.addEventListener('click', handleOpen);
      item.addEventListener('keydown', handleKeyDown);

      cleanupItem = () => {
        item.removeEventListener('mousedown', handleOpen);
        item.removeEventListener('click', handleOpen);
        item.removeEventListener('keydown', handleKeyDown);
      };

      return true;
    };

    frameId = window.requestAnimationFrame(() => {
      if (!installStyleSettingsItem()) {
        retryTimer = window.setTimeout(installStyleSettingsItem, 250);
      }
    });

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (retryTimer) window.clearTimeout(retryTimer);
      cleanupItem?.();
    };
  }, [openStyleDialog, quillRef]);

  const submitLabel = mode === 'edit' ? '수정하기' : '등록하기';
  const submittingLabel = mode === 'edit' ? '수정 중...' : '업로드 중...';
  const selectedCategoryIndex = CATEGORY_OPTIONS.findIndex((option) => option.value === category);
  const categorySelectionClass = selectedCategoryIndex <= 0 ? 'is-left-selected' : 'is-right-selected';

  return (
    <>
      <div className="container mt-4 h-100 writing-page-shell">
        <form onSubmit={onSubmit} className="writing-form writing-form--workspace">
          <div className="writing-workspace">
            <section className="writing-editor-panel" aria-label="본문 작성">
              <div
                className="writing-editor-container"
                style={{ '--rich-text-editor-height': editorHeight, ...contentStyleVariables }}
              >
                <ReactQuill
                  ref={quillRef}
                  className="writing-editor rich-text-editor"
                  theme="snow"
                  value={content}
                  onChange={onContentChange}
                  modules={modules}
                  formats={formats}
                  placeholder="내용을 입력하세요..."
                  style={{
                    height: 'auto',
                    '--rich-text-editor-height': editorHeight,
                    ...contentStyleVariables,
                  }}
                />
              </div>
            </section>

            <aside className="writing-sidebar" aria-label="게시글 설정">
              <section className="writing-side-panel">
                <input
                  type="text"
                  className="form-control writing-sidebar-input"
                  id="titleInput"
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  aria-label="제목"
                  placeholder="게시글 이름을 입력하세요"
                  maxLength={100}
                  required
                />
              </section>

              <section className="writing-side-panel writing-settings-panel">
                <div className="writing-setting-group">
                  <div
                    className={`writing-segmented-control ${isPublic ? 'is-left-selected' : 'is-right-selected'}`}
                    role="group"
                    aria-label="공개 상태"
                  >
                    <button
                      type="button"
                      className={`writing-segment-button ${isPublic ? 'is-selected' : ''}`}
                      aria-pressed={isPublic}
                      onClick={() => onPublicChange(true)}
                    >
                      공개
                    </button>
                    <button
                      type="button"
                      className={`writing-segment-button ${!isPublic ? 'is-selected' : ''}`}
                      aria-pressed={!isPublic}
                      onClick={() => onPublicChange(false)}
                    >
                      비공개
                    </button>
                  </div>
                </div>

                <div className="writing-setting-group">
                  <div
                    className={`writing-segmented-control ${categorySelectionClass}`}
                    role="group"
                    aria-label="카테고리"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <button
                        type="button"
                        className={`writing-segment-button ${category === option.value ? 'is-selected' : ''}`}
                        aria-pressed={category === option.value}
                        onClick={() => onCategoryChange(option.value)}
                        key={option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="writing-side-panel">
                <TagInput tags={tags} onChange={onTagsChange} />
              </section>

              <button
                type="submit"
                className="btn btn-primary btn-primary-solid writing-submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? submittingLabel : submitLabel}
              </button>
              {statusMessage && (
                <div className="writing-submit-status" aria-live="polite">
                  {statusMessage}
                </div>
              )}
            </aside>
          </div>
        </form>
      </div>

      <TextEditorFormulaDialog
        isOpen={formulaDialog.isOpen}
        onClose={formulaDialog.onClose}
        onSave={formulaDialog.onSave}
        initialValue={formulaDialog.initialValue}
      />
      <TextEditorStyleDialog
        isOpen={isStyleDialogOpen}
        value={contentStyleSettings}
        onClose={closeStyleDialog}
        onSave={onContentStyleSettingsChange}
      />
    </>
  );
}

export default PostEditorForm;
