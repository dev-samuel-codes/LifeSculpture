import React, { useState } from 'react';

function CommentComposer({
  placeholder,
  onSubmit,
  disabled = false,
  rows = 3,
  submitLabel = '댓글',
  maxLength = 1000,
}) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || submitting) return;
    if (trimmed.length > maxLength) {
      alert(`내용은 최대 ${maxLength}자까지 작성할 수 있습니다.`);
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit(trimmed);
      setValue('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="comment-composer" onSubmit={handleSubmit}>
      <textarea
        className="comment-input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled || submitting}
      />
      <div className="comment-actions">
        <button
          type="submit"
          className="comment-submit-button"
          disabled={disabled || submitting || !value.trim()}
        >
          {submitting ? '작성 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default CommentComposer;
