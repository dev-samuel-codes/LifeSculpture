const SHORTCUT_SOURCE = 'user';
const SILENT_SOURCE = 'silent';
const HANDLED_EVENT_FLAG = '__lifeSculptureEditorShortcutHandled';

const LINE_FORMAT_KEYS = ['indent', 'align', 'direction'];
const EMPTY_CANCELABLE_BLOCK_FORMATS = ['blockquote', 'code-block'];
const AUTO_MARKER_SOURCE =
  '(?:->|→|\\d+[.)]|[A-Za-z][.)]|[-*+•○●◦◯‣▪‧·–—#>])';
const AUTO_SYMBOL_MARKER_REGEX = new RegExp(`^(\\s*)(${AUTO_MARKER_SOURCE})$`, 'u');
const AUTO_SYMBOL_REGEX = new RegExp(`^(\\s*)(${AUTO_MARKER_SOURCE})(\\s+)(.*)$`, 'u');

const getEditorLength = (editor) => Math.max((editor?.getLength?.() || 1) - 1, 0);

const getActiveRange = (editor, range) =>
  range || editor?.getSelection?.(true) || editor?.selection?.savedRange || null;

const getLineDetails = (editor, index) => {
  if (!editor || typeof editor.getLine !== 'function') return null;

  const [line] = editor.getLine(Math.max(index, 0));
  if (!line || typeof editor.getIndex !== 'function') return null;

  const lineIndex = editor.getIndex(line);
  const lineLength = typeof line.length === 'function' ? line.length() : 0;
  const rawText = editor.getText(lineIndex, lineLength);
  const text = rawText.endsWith('\n') ? rawText.slice(0, -1) : rawText;

  return {
    line,
    index: lineIndex,
    length: lineLength,
    text,
  };
};

const isEditorFocused = (editor, target) => {
  const root = editor?.root;
  if (!root || typeof document === 'undefined') return false;

  const activeElement = document.activeElement;
  const canUseNode = typeof Node !== 'undefined';
  return Boolean(
    (canUseNode && target instanceof Node && root.contains(target)) ||
      activeElement === root ||
      (canUseNode && activeElement instanceof Node && root.contains(activeElement)),
  );
};

const copyLineFormats = (editor, sourceIndex, targetIndex) => {
  const sourceFormat = editor.getFormat(sourceIndex, 1);

  LINE_FORMAT_KEYS.forEach((formatKey) => {
    if (sourceFormat?.[formatKey]) {
      editor.formatLine(targetIndex, 1, formatKey, sourceFormat[formatKey], SHORTCUT_SOURCE);
    }
  });
};

const normalizeAutoMarker = (marker) => {
  if (marker === '->') return '→';
  if (['•', '●', '◦', '◯'].includes(marker)) return '○';
  return marker;
};

const getNextContinuationMarker = (marker) => {
  const normalizedMarker = normalizeAutoMarker(marker);
  const numericMarker = normalizedMarker.match(/^(\d+)([.)])$/);
  if (numericMarker) {
    return `${Number(numericMarker[1]) + 1}${numericMarker[2]}`;
  }

  const alphaMarker = normalizedMarker.match(/^([A-Za-z])([.)])$/);
  if (alphaMarker) {
    const code = alphaMarker[1].charCodeAt(0);
    const isUppercase = code >= 65 && code <= 90;
    const boundary = isUppercase ? 90 : 122;
    const nextCode = code >= boundary ? code : code + 1;
    return `${String.fromCharCode(nextCode)}${alphaMarker[2]}`;
  }

  return normalizedMarker;
};

export const selectAllEditorContent = (editor) => {
  if (!editor || typeof editor.setSelection !== 'function') return false;

  editor.focus?.();
  editor.setSelection(0, getEditorLength(editor), SHORTCUT_SOURCE);
  return false;
};

export const selectCurrentLine = (editor, range) => {
  const activeRange = getActiveRange(editor, range);
  if (!editor || !activeRange || typeof editor.setSelection !== 'function') return false;

  const lineDetails = getLineDetails(editor, activeRange.index);
  if (!lineDetails) return false;

  editor.focus?.();
  editor.setSelection(
    lineDetails.index,
    Math.max(lineDetails.length - 1, 0),
    SHORTCUT_SOURCE,
  );
  return false;
};

export const indentCurrentLines = (editor, range, direction = 'indent') => {
  const activeRange = getActiveRange(editor, range);
  if (!editor || !activeRange || typeof editor.formatLine !== 'function') return false;

  const indentValue = direction === 'outdent' ? '-1' : '+1';
  editor.formatLine(
    activeRange.index,
    Math.max(activeRange.length, 1),
    'indent',
    indentValue,
    SHORTCUT_SOURCE,
  );
  editor.setSelection?.(activeRange.index, activeRange.length, SILENT_SOURCE);
  return false;
};

export const handleAutoSymbolEnter = (editor, range) => {
  const activeRange = getActiveRange(editor, range);
  if (!editor || !activeRange || activeRange.length > 0) return false;

  const lineDetails = getLineDetails(editor, activeRange.index);
  if (!lineDetails) return false;

  const cursorOffset = activeRange.index - lineDetails.index;
  if (cursorOffset < lineDetails.text.length) return false;

  const lineFormat = editor.getFormat(lineDetails.index, Math.max(lineDetails.length, 1));
  if (lineFormat?.list) return false;

  const match = lineDetails.text.match(AUTO_SYMBOL_REGEX);
  if (!match) return false;

  const [, leadingSpace, marker, markerGap, bodyText] = match;
  const normalizedMarker = normalizeAutoMarker(marker);

  if (bodyText.trim().length === 0) {
    editor.deleteText(lineDetails.index, lineDetails.text.length, SHORTCUT_SOURCE);
    editor.setSelection(lineDetails.index, 0, SILENT_SOURCE);
    return true;
  }

  const nextMarker = getNextContinuationMarker(normalizedMarker);
  const nextPrefix = `${leadingSpace}${nextMarker}${markerGap}`;
  editor.insertText(activeRange.index, `\n${nextPrefix}`, SHORTCUT_SOURCE);
  copyLineFormats(editor, lineDetails.index, activeRange.index + 1);
  editor.setSelection(activeRange.index + 1 + nextPrefix.length, 0, SILENT_SOURCE);
  return true;
};

export const handleLiteralMarkerSpace = (editor, range) => {
  const activeRange = getActiveRange(editor, range);
  if (!editor || !activeRange || activeRange.length > 0) return false;

  const lineDetails = getLineDetails(editor, activeRange.index);
  if (!lineDetails) return false;

  const cursorOffset = activeRange.index - lineDetails.index;
  if (cursorOffset !== lineDetails.text.length) return false;

  const textBeforeCursor = lineDetails.text.slice(0, cursorOffset);
  const match = textBeforeCursor.match(AUTO_SYMBOL_MARKER_REGEX);
  if (!match) return false;

  const [, leadingSpace, marker] = match;
  const nextPrefix = `${leadingSpace}${normalizeAutoMarker(marker)} `;
  editor.deleteText(lineDetails.index, cursorOffset, SHORTCUT_SOURCE);
  editor.insertText(lineDetails.index, nextPrefix, SHORTCUT_SOURCE);
  editor.setSelection(lineDetails.index + nextPrefix.length, 0, SILENT_SOURCE);
  return true;
};

export const handleArrowMarkerInput = (editor, range) => {
  const activeRange = getActiveRange(editor, range);
  if (!editor || !activeRange || activeRange.length > 0) return false;

  const lineDetails = getLineDetails(editor, activeRange.index);
  if (!lineDetails) return false;

  const cursorOffset = activeRange.index - lineDetails.index;
  if (cursorOffset !== lineDetails.text.length) return false;

  const match = lineDetails.text.slice(0, cursorOffset).match(/^(\s*)-$/u);
  if (!match) return false;

  const nextMarker = `${match[1]}→`;
  editor.deleteText(lineDetails.index, cursorOffset, SHORTCUT_SOURCE);
  editor.insertText(lineDetails.index, nextMarker, SHORTCUT_SOURCE);
  editor.setSelection(lineDetails.index + nextMarker.length, 0, SILENT_SOURCE);
  return true;
};

export const handleEmptyBlockBackspace = (editor, range) => {
  const activeRange = getActiveRange(editor, range);
  if (!editor || !activeRange || activeRange.length > 0) return false;

  const lineDetails = getLineDetails(editor, activeRange.index);
  if (!lineDetails || lineDetails.text.trim().length > 0) return false;

  const cursorOffset = activeRange.index - lineDetails.index;
  if (cursorOffset !== 0) return false;

  const lineFormat = editor.getFormat(lineDetails.index, Math.max(lineDetails.length, 1));
  const formatToClear = EMPTY_CANCELABLE_BLOCK_FORMATS.find((formatKey) => lineFormat?.[formatKey]);
  if (!formatToClear) return false;

  editor.formatLine(lineDetails.index, Math.max(lineDetails.length, 1), formatToClear, false, SHORTCUT_SOURCE);
  editor.setSelection(lineDetails.index, 0, SILENT_SOURCE);
  return true;
};

export const setupEditorCommandShortcuts = (editor) => {
  if (!editor || typeof document === 'undefined') return () => {};

  const handleKeyDown = (event) => {
    if (event[HANDLED_EVENT_FLAG]) return;
    if (!isEditorFocused(editor, event.target)) return;
    if (event.defaultPrevented || event.isComposing) return;

    const key = String(event.key || '').toLowerCase();

    if (!event.altKey && !event.metaKey && !event.ctrlKey && key === 'enter') {
      if (handleAutoSymbolEnter(editor)) {
        event[HANDLED_EVENT_FLAG] = true;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
      return;
    }

    if (!event.altKey && !event.metaKey && !event.ctrlKey && event.key === '>') {
      if (handleArrowMarkerInput(editor)) {
        event[HANDLED_EVENT_FLAG] = true;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
      return;
    }

    if (!event.altKey && !event.metaKey && !event.ctrlKey && key === ' ') {
      if (handleLiteralMarkerSpace(editor)) {
        event[HANDLED_EVENT_FLAG] = true;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
      return;
    }

    if (!event.altKey && !event.metaKey && !event.ctrlKey && key === 'backspace') {
      if (handleEmptyBlockBackspace(editor)) {
        event[HANDLED_EVENT_FLAG] = true;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
      return;
    }

    if (event.altKey || !(event.metaKey || event.ctrlKey)) return;

    if (key === 'a') {
      event[HANDLED_EVENT_FLAG] = true;
      event.preventDefault();
      event.stopPropagation();
      selectAllEditorContent(editor);
      return;
    }

    if (key === 'l') {
      event[HANDLED_EVENT_FLAG] = true;
      event.preventDefault();
      event.stopPropagation();
      selectCurrentLine(editor);
    }
  };

  document.addEventListener('keydown', handleKeyDown, true);
  editor.root?.addEventListener?.('keydown', handleKeyDown, true);
  return () => {
    document.removeEventListener('keydown', handleKeyDown, true);
    editor.root?.removeEventListener?.('keydown', handleKeyDown, true);
  };
};
