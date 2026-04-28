import { useCallback, useEffect } from 'react';
import { convertHeicToJpeg } from '../utils/media';
import { setupResponsiveImageSizing } from '../utils/imageSizing';
import { setupEditorCommandShortcuts } from '../utils/keyboardShortcuts';
import { setupTableResizing } from '../utils/tableResizing';

const DEFAULT_EDITOR_ALIGN = 'justify';

const TOOLBAR_SELECTION_CONTROL_SELECTOR = [
  'button',
  '.ql-picker-label',
  '.ql-picker-item',
  '.ql-color-picker',
  '.ql-icon-picker',
].join(', ');

const PRESERVED_SELECTION_OVERLAY_CLASS = 'ql-preserved-selection-overlay';
const PRESERVED_SELECTION_RECT_CLASS = 'ql-preserved-selection-rect';
const PRESERVED_SELECTION_HORIZONTAL_MARGIN = 2;
const PRESERVED_SELECTION_VERTICAL_MARGIN = 1;

const getElementFromNode = (node) => {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
};

const isTableSelection = (editor) => {
  if (typeof document === 'undefined' || !editor?.root) return false;

  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const selectionNodes = [
    selection.anchorNode,
    selection.focusNode,
    range.commonAncestorContainer,
  ].filter(Boolean);

  return selectionNodes.some((node) => {
    const element = getElementFromNode(node);
    const tableElement = element?.closest?.('table, td, th');
    return Boolean(tableElement && editor.root.contains(tableElement));
  });
};

const getSafeSelectionRange = (editor, range) => {
  if (!editor || !range) return null;

  const editorLength = editor.getLength();
  const index = Math.min(Math.max(range.index, 0), editorLength);
  const length = Math.min(Math.max(range.length || 0, 0), Math.max(editorLength - index, 0));

  return { index, length };
};

const getStoredSelectionRange = (editor) =>
  editor?.getSelection?.() ||
  editor?.selection?.savedRange ||
  editor?.selection?.lastRange ||
  null;

const clearSelectionOverlay = (overlay) => {
  if (!overlay) return;

  overlay.replaceChildren();
  overlay.hidden = true;
};

const ensureSelectionOverlay = (editor) => {
  const container = editor?.container || editor?.root?.parentElement;
  if (!container || typeof document === 'undefined') return null;

  const existingOverlay = Array.from(container.children).find((child) =>
    child.classList?.contains(PRESERVED_SELECTION_OVERLAY_CLASS),
  );
  if (existingOverlay) return existingOverlay;

  const overlay = document.createElement('div');
  overlay.className = PRESERVED_SELECTION_OVERLAY_CLASS;
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  container.appendChild(overlay);
  return overlay;
};

const getNativeSelectionRects = (editor, container) => {
  if (typeof document === 'undefined') return [];

  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return [];
  }

  const root = editor?.root;
  if (!root) return [];

  const selectionNodes = [selection.anchorNode, selection.focusNode].filter(Boolean);
  const hasEditorSelection = selectionNodes.some((node) => root.contains(node));
  if (!hasEditorSelection) return [];

  const containerRect = container.getBoundingClientRect();
  const range = selection.getRangeAt(0);
  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
    }));
};

const getQuillSelectionRects = (editor, container, range) => {
  if (!editor || !container || !range || typeof editor.getBounds !== 'function') {
    return [];
  }

  const bounds = editor.getBounds(range.index, range.length);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return [];
  }

  const rootRect = editor.root.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return [
    {
      left: rootRect.left - containerRect.left + bounds.left,
      top: rootRect.top - containerRect.top + bounds.top,
      width: Math.max(bounds.width, 2),
      height: bounds.height,
    },
  ];
};

const renderSelectionOverlay = (editor, overlay, range, cachedRects = []) => {
  const safeRange = getSafeSelectionRange(editor, range);
  if (!safeRange || safeRange.length <= 0 || !overlay?.parentElement || isTableSelection(editor)) {
    clearSelectionOverlay(overlay);
    return;
  }

  const container = overlay.parentElement;
  const rects = cachedRects.length > 0 ? cachedRects : getNativeSelectionRects(editor, container);
  const selectionRects =
    rects.length > 0 ? rects : getQuillSelectionRects(editor, container, safeRange);

  if (selectionRects.length === 0) {
    clearSelectionOverlay(overlay);
    return;
  }

  overlay.replaceChildren(
    ...selectionRects.map((rect) => {
      const rectElement = document.createElement('span');
      rectElement.className = PRESERVED_SELECTION_RECT_CLASS;
      rectElement.style.left = `${rect.left - PRESERVED_SELECTION_HORIZONTAL_MARGIN}px`;
      rectElement.style.top = `${rect.top - PRESERVED_SELECTION_VERTICAL_MARGIN}px`;
      rectElement.style.width = `${rect.width + PRESERVED_SELECTION_HORIZONTAL_MARGIN * 2}px`;
      rectElement.style.height = `${rect.height + PRESERVED_SELECTION_VERTICAL_MARGIN * 2}px`;
      return rectElement;
    }),
  );
  overlay.hidden = false;
};

const setupToolbarSelectionPreservation = (editor) => {
  const toolbar = editor?.getModule('toolbar')?.container;
  if (!editor || !toolbar || typeof toolbar.addEventListener !== 'function') {
    return () => {};
  }

  const overlay = ensureSelectionOverlay(editor);
  let lastRange = getStoredSelectionRange(editor);
  let lastVisibleRange = lastRange?.length > 0 ? lastRange : null;
  let lastVisibleRects = [];
  let isToolbarInteracting = false;
  let restoreFrame = null;

  const captureVisibleSelection = (range = getStoredSelectionRange(editor)) => {
    const safeRange = getSafeSelectionRange(editor, range);
    if (!safeRange || safeRange.length <= 0 || !overlay?.parentElement || isTableSelection(editor)) {
      return false;
    }

    const container = overlay.parentElement;
    const rects = getNativeSelectionRects(editor, container);
    const fallbackRects = rects.length > 0 ? rects : getQuillSelectionRects(editor, container, safeRange);

    if (fallbackRects.length === 0) {
      return false;
    }

    lastRange = safeRange;
    lastVisibleRange = safeRange;
    lastVisibleRects = fallbackRects;
    return true;
  };

  const renderCachedSelectionOverlay = () => {
    renderSelectionOverlay(editor, overlay, lastVisibleRange || lastRange, lastVisibleRects);
  };

  const hidePreservedSelection = () => {
    isToolbarInteracting = false;
    clearSelectionOverlay(overlay);
  };

  const scheduleSelectionOverlayRefresh = () => {
    if (restoreFrame) {
      window.cancelAnimationFrame(restoreFrame);
    }

    restoreFrame = window.requestAnimationFrame(() => {
      restoreFrame = null;
      captureVisibleSelection(lastVisibleRange || getStoredSelectionRange(editor) || lastRange);
      renderCachedSelectionOverlay();
    });
  };

  const handleSelectionChange = (range, oldRange) => {
    const oldVisibleRange = oldRange?.length > 0 ? oldRange : null;

    if (range) {
      if (range.length === 0) {
        if (!lastVisibleRange && oldVisibleRange) {
          lastVisibleRange = oldVisibleRange;
        }

        if (isToolbarInteracting && lastVisibleRange) {
          renderCachedSelectionOverlay();
        } else {
          lastRange = range;
          hidePreservedSelection();
        }
        return;
      }

      lastRange = range;
      lastVisibleRange = range;
      captureVisibleSelection(range);
      if (isToolbarInteracting) {
        renderCachedSelectionOverlay();
      }
      return;
    }

    if (!lastVisibleRange && oldVisibleRange) {
      lastVisibleRange = oldVisibleRange;
    }

    if (isToolbarInteracting && lastVisibleRange) {
      renderCachedSelectionOverlay();
    } else {
      hidePreservedSelection();
    }
  };

  const handleDocumentSelectionChange = () => {
    if (isToolbarInteracting) return;
    if (!captureVisibleSelection()) {
      hidePreservedSelection();
    }
  };

  const handleEditorSelectionCapture = () => {
    if (isToolbarInteracting) return;
    window.requestAnimationFrame(() => {
      captureVisibleSelection();
    });
  };

  const isToolbarSelectionControl = (target) => {
    if (!(target instanceof Element)) return false;

    const targetControl = target.closest(TOOLBAR_SELECTION_CONTROL_SELECTOR);
    return Boolean(targetControl && toolbar.contains(targetControl));
  };

  const handleToolbarPointerDown = (event) => {
    if (typeof event.button === 'number' && event.button !== 0) return;
    if (!isToolbarSelectionControl(event.target)) return;

    const currentRange = getStoredSelectionRange(editor);
    if (currentRange) {
      lastRange = currentRange;
      if (currentRange.length > 0) {
        lastVisibleRange = currentRange;
      }
    }

    isToolbarInteracting = true;
    captureVisibleSelection(lastVisibleRange || lastRange);
    renderCachedSelectionOverlay();
  };

  const handleToolbarClick = (event) => {
    if (!isToolbarSelectionControl(event.target)) return;

    isToolbarInteracting = true;
    renderCachedSelectionOverlay();
    scheduleSelectionOverlayRefresh();
  };

  const handleEditorInteraction = () => {
    hidePreservedSelection();
  };

  const handleDocumentPointerDown = (event) => {
    if (!(event.target instanceof Element)) return;
    if (toolbar.contains(event.target) || editor.root.contains(event.target)) return;

    hidePreservedSelection();
  };

  const pointerEventName =
    typeof window !== 'undefined' && 'PointerEvent' in window ? 'pointerdown' : 'mousedown';

  editor.on('selection-change', handleSelectionChange);
  document.addEventListener('selectionchange', handleDocumentSelectionChange);
  toolbar.addEventListener(pointerEventName, handleToolbarPointerDown, true);
  toolbar.addEventListener('click', handleToolbarClick, true);
  editor.root.addEventListener('mouseup', handleEditorSelectionCapture);
  editor.root.addEventListener('keyup', handleEditorSelectionCapture);
  editor.root.addEventListener(pointerEventName, handleEditorInteraction, true);
  editor.root.addEventListener('keydown', handleEditorInteraction, true);
  document.addEventListener(pointerEventName, handleDocumentPointerDown, true);

  return () => {
    if (restoreFrame) {
      window.cancelAnimationFrame(restoreFrame);
    }
    editor.off('selection-change', handleSelectionChange);
    document.removeEventListener('selectionchange', handleDocumentSelectionChange);
    toolbar.removeEventListener(pointerEventName, handleToolbarPointerDown, true);
    toolbar.removeEventListener('click', handleToolbarClick, true);
    editor.root.removeEventListener('mouseup', handleEditorSelectionCapture);
    editor.root.removeEventListener('keyup', handleEditorSelectionCapture);
    editor.root.removeEventListener(pointerEventName, handleEditorInteraction, true);
    editor.root.removeEventListener('keydown', handleEditorInteraction, true);
    document.removeEventListener(pointerEventName, handleDocumentPointerDown, true);
    overlay?.remove();
  };
};

const isEditorEmpty = (editor) => (editor?.getText?.() || '').trim().length === 0;

const hasDefaultAlignedFirstBlock = (editor) => {
  const firstBlock = editor?.root?.querySelector?.('p, h1, h2, h3, h4, h5, h6, blockquote, pre');
  return Boolean(firstBlock?.classList?.contains(`ql-align-${DEFAULT_EDITOR_ALIGN}`));
};

const syncToolbarAlignPicker = (editor) => {
  const alignPicker = editor?.getModule?.('toolbar')?.container?.querySelector?.(
    '.ql-picker.ql-align',
  );
  if (!alignPicker) return;

  const pickerLabel = alignPicker.querySelector('.ql-picker-label');
  const pickerItems = Array.from(alignPicker.querySelectorAll('.ql-picker-item'));
  const defaultItem = pickerItems.find(
    (item) => item.getAttribute('data-value') === DEFAULT_EDITOR_ALIGN,
  );

  pickerLabel?.setAttribute('data-value', DEFAULT_EDITOR_ALIGN);
  pickerLabel?.setAttribute('aria-label', DEFAULT_EDITOR_ALIGN);
  pickerItems.forEach((item) => item.classList.remove('ql-selected'));
  defaultItem?.classList.add('ql-selected');
};

const applyDefaultAlignment = (editor) => {
  if (!editor || typeof editor.formatLine !== 'function') return;

  const currentFormat = editor.getFormat?.(0, 1);
  if (!isEditorEmpty(editor)) {
    if (currentFormat?.align === DEFAULT_EDITOR_ALIGN || hasDefaultAlignedFirstBlock(editor)) {
      syncToolbarAlignPicker(editor);
    }
    return;
  }

  if (currentFormat?.align) {
    if (currentFormat.align === DEFAULT_EDITOR_ALIGN) {
      syncToolbarAlignPicker(editor);
    }
    return;
  }

  editor.formatLine(0, 1, 'align', DEFAULT_EDITOR_ALIGN, 'silent');
  syncToolbarAlignPicker(editor);
};

const setupDefaultAlignment = (editor) => {
  if (!editor) return () => {};

  const timeoutIds = new Set();
  const scheduleDefaultAlignment = (delay = 0) => {
    const run = () => {
      window.requestAnimationFrame?.(() => applyDefaultAlignment(editor));
    };

    if (delay > 0) {
      const timeoutId = window.setTimeout(() => {
        timeoutIds.delete(timeoutId);
        run();
      }, delay);
      timeoutIds.add(timeoutId);
      return;
    }

    run();
  };

  applyDefaultAlignment(editor);
  scheduleDefaultAlignment();
  scheduleDefaultAlignment(100);
  scheduleDefaultAlignment(300);

  const handleTextChange = () => {
    scheduleDefaultAlignment();
  };

  editor.on?.('text-change', handleTextChange);

  return () => {
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIds.clear();
    editor.off?.('text-change', handleTextChange);
  };
};

function useQuillEditorBridge({
  quillRef,
  enabled = true,
  content,
  onPendingImage,
  onOpenFormulaEditor,
  onContentChange,
}) {
  const handleImageInsert = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.click();

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        const processedFile = await convertHeicToJpeg(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          const tempUrl = event.target?.result;
          if (!tempUrl) return;

          onPendingImage?.({ file: processedFile, tempUrl });
          const editor = quillRef.current?.getEditor();
          if (!editor) return;

          const range = editor.getSelection(true) || { index: editor.getLength() };
          editor.insertEmbed(range.index, 'image', tempUrl, 'user');
          editor.setSelection(range.index + 1, 0);
        };
        reader.readAsDataURL(processedFile);
      } catch (error) {
        alert(`이미지 처리 실패: ${error.message}`);
      }
    };
  }, [onPendingImage, quillRef]);

  useEffect(() => {
    if (!enabled) return undefined;
    let retryTimer;
    let cleanupToolbarSelectionPreservation = null;
    let cleanupCommandShortcuts = null;
    let cleanupTableResizing = null;
    let cleanupDefaultAlignment = null;
    let retryCount = 0;

    const setupEditor = () => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return false;
      const toolbarModule = editor.getModule('toolbar');
      if (!toolbarModule?.container) return false;

      window.quillEditor = editor;
      window.openFormulaEditor = (initialValue, onSaveCallback) => {
        onOpenFormulaEditor?.(initialValue, onSaveCallback);
      };
      toolbarModule.addHandler('image', handleImageInsert);
      cleanupDefaultAlignment?.();
      cleanupDefaultAlignment = setupDefaultAlignment(editor);
      cleanupToolbarSelectionPreservation?.();
      cleanupToolbarSelectionPreservation = setupToolbarSelectionPreservation(editor);
      cleanupCommandShortcuts?.();
      cleanupCommandShortcuts = setupEditorCommandShortcuts(editor);
      cleanupTableResizing?.();
      cleanupTableResizing = setupTableResizing({
        root: editor.root,
        editor,
        onResize: onContentChange,
      });
      return true;
    };

    const scheduleSetup = (delay = 100) => {
      retryTimer = setTimeout(() => {
        if (setupEditor()) return;
        retryCount += 1;
        if (retryCount < 20) {
          scheduleSetup(150);
        }
      }, delay);
    };

    scheduleSetup();

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      cleanupToolbarSelectionPreservation?.();
      cleanupCommandShortcuts?.();
      cleanupTableResizing?.();
      cleanupDefaultAlignment?.();
      window.openFormulaEditor = null;
    };
  }, [enabled, handleImageInsert, onContentChange, onOpenFormulaEditor, quillRef]);

  useEffect(() => {
    if (!enabled) return undefined;
    const editor = quillRef.current?.getEditor();
    if (!editor) return undefined;

    return setupResponsiveImageSizing({ root: editor.root });
  }, [content, enabled, quillRef]);
}

export default useQuillEditorBridge;
