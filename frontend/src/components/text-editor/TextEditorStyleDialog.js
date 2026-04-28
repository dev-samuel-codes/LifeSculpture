import React, { useEffect, useMemo, useState } from 'react';
import {
  FaAlignCenter,
  FaAlignJustify,
  FaAlignLeft,
  FaAlignRight,
  FaBold,
} from 'react-icons/fa';
import {
  ALIGN_OPTIONS,
  CONTENT_STYLE_DEFINITIONS,
  FONT_OPTIONS,
  SIZE_OPTIONS,
  WEIGHT_OPTIONS,
  createDefaultContentStyleSettings,
  describeContentStyle,
  getContentStyleCssVariables,
  getContentStyleLabel,
  getFontOption,
  normalizeContentStyleSettings,
} from './utils/contentStyleSettings';

const ALIGN_ICONS = {
  left: FaAlignLeft,
  center: FaAlignCenter,
  right: FaAlignRight,
  justify: FaAlignJustify,
};

const TextEditorStyleDialog = ({ isOpen, value, onClose, onSave }) => {
  const [draft, setDraft] = useState(() => normalizeContentStyleSettings(value));
  const [activeStyleKey, setActiveStyleKey] = useState('normal');

  useEffect(() => {
    if (!isOpen) return;
    setDraft(normalizeContentStyleSettings(value));
    setActiveStyleKey('normal');
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeStyle = draft.styles[activeStyleKey] || draft.styles.normal;
  const activeFontOption = getFontOption(activeStyle.font);
  const previewVariables = useMemo(() => getContentStyleCssVariables(draft), [draft]);
  const activeDefinition =
    CONTENT_STYLE_DEFINITIONS.find((definition) => definition.key === activeStyleKey) ||
    CONTENT_STYLE_DEFINITIONS[0];
  const PreviewTag = activeStyleKey === 'normal' ? 'p' : activeStyleKey;

  const updateActiveStyle = (nextPartialStyle) => {
    setDraft((prev) => ({
      ...prev,
      styles: {
        ...prev.styles,
        [activeStyleKey]: {
          ...prev.styles[activeStyleKey],
          ...nextPartialStyle,
        },
      },
    }));
  };

  const resetActiveStyle = () => {
    const defaults = createDefaultContentStyleSettings();
    setDraft((prev) => ({
      ...prev,
      styles: {
        ...prev.styles,
        [activeStyleKey]: defaults.styles[activeStyleKey],
      },
    }));
  };

  const handleSave = () => {
    onSave(normalizeContentStyleSettings(draft));
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="style-editor-overlay" onClick={onClose}>
      <div
        className="style-editor-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="style-editor-title"
      >
        <header className="style-editor-header">
          <h3 id="style-editor-title">스타일 수정</h3>
          <button type="button" className="style-editor-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="style-editor-body">
          <div className="style-editor-controls-grid">
            <section
              className="style-editor-section style-editor-section--properties"
              aria-labelledby="style-editor-properties"
            >
              <h4 id="style-editor-properties">속성</h4>
              <div className="style-editor-property-grid">
                <label className="style-editor-field">
                  <span>이름</span>
                  <select
                    value={activeStyleKey}
                    onChange={(event) => setActiveStyleKey(event.target.value)}
                  >
                    {CONTENT_STYLE_DEFINITIONS.map((definition) => (
                      <option value={definition.key} key={definition.key}>
                        {definition.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section
              className="style-editor-section style-editor-section--format"
              aria-labelledby="style-editor-format"
            >
              <h4 id="style-editor-format">서식</h4>
              <div className="style-editor-format-grid">
                <label className="style-editor-field style-editor-font-field">
                  <span>글꼴</span>
                  <select
                    value={activeStyle.font}
                    onChange={(event) => updateActiveStyle({ font: event.target.value })}
                    style={{ fontFamily: activeFontOption.family }}
                  >
                    {FONT_OPTIONS.map((option) => (
                      <option
                        value={option.value}
                        key={option.value}
                        style={{ fontFamily: option.family }}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="style-editor-field style-editor-size-field">
                  <span>크기</span>
                  <select
                    value={activeStyle.size}
                    onChange={(event) => updateActiveStyle({ size: event.target.value })}
                  >
                    {SIZE_OPTIONS.map((size) => (
                      <option value={size} key={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="style-editor-button-field">
                  <span>굵기</span>
                  <div className="style-editor-toggle-group" aria-label="글자 굵기">
                    {WEIGHT_OPTIONS.map((option) => {
                      const isActive = activeStyle.weight === option.value;
                      return (
                        <button
                          type="button"
                          className={isActive ? 'is-active' : ''}
                          onClick={() => updateActiveStyle({ weight: option.value })}
                          aria-pressed={isActive}
                          aria-label={option.label}
                          title={option.label}
                          key={option.value}
                        >
                          {option.value === '700' && <FaBold aria-hidden="true" />}
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="style-editor-field style-editor-color-field">
                  <span>색상</span>
                  <input
                    type="color"
                    value={activeStyle.color}
                    onChange={(event) => updateActiveStyle({ color: event.target.value })}
                    aria-label={`${getContentStyleLabel(activeStyleKey)} 색상`}
                  />
                </label>

                <div className="style-editor-button-field style-editor-align-field">
                  <span>정렬</span>
                  <div className="style-editor-align-group" aria-label="문단 정렬">
                    {ALIGN_OPTIONS.map((option) => {
                      const AlignIcon = ALIGN_ICONS[option.value];
                      const isActive = activeStyle.align === option.value;
                      return (
                        <button
                          type="button"
                          className={isActive ? 'is-active' : ''}
                          onClick={() => updateActiveStyle({ align: option.value })}
                          aria-pressed={isActive}
                          aria-label={option.label}
                          title={option.label}
                          key={option.value}
                        >
                          <AlignIcon aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="style-editor-preview-shell" aria-label="스타일 미리보기">
            <div className="style-editor-preview rich-text" style={previewVariables}>
              <p className="style-editor-preview-muted">이전 단락 이전 단락 이전 단락 이전 단락</p>
              <PreviewTag>
                가나다AaBBCcYyZz123
                {activeStyleKey === 'normal'
                  ? ' 본문 스타일 미리보기'
                  : ` ${activeDefinition.label}`}
              </PreviewTag>
              <p className="style-editor-preview-muted">이어지는 문장 이어지는 문장 이어지는 문장</p>
            </div>
            <div className="style-editor-summary">
              <strong>{getContentStyleLabel(activeStyleKey)}</strong>
              <span>{describeContentStyle(activeStyle)}</span>
              <span>표시 글꼴: {activeFontOption.label}</span>
            </div>
          </section>
        </div>

        <footer className="style-editor-footer">
          <button type="button" className="style-editor-reset" onClick={resetActiveStyle}>
            선택 스타일 초기화
          </button>
          <div className="style-editor-footer-actions">
            <button type="button" className="style-editor-cancel" onClick={onClose}>
              취소
            </button>
            <button type="button" className="style-editor-confirm" onClick={handleSave}>
              확인
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default TextEditorStyleDialog;
