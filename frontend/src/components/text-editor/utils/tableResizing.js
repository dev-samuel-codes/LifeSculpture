const RESIZE_HANDLE_CLASS = 'ql-table-resize-handle';
const MOVE_HANDLE_CLASS = 'ql-table-move-handle';
const TABLE_MENU_CLASS = 'ql-table-action-menu';
const MIN_TABLE_WIDTH = 160;

const findTableFromTarget = (root, target) => {
  if (!(target instanceof Element)) return null;
  const table = target.closest('table');
  return table && root.contains(table) ? table : null;
};

const findCellFromTarget = (root, target) => {
  if (!(target instanceof Element)) return null;
  const cell = target.closest('td, th');
  return cell && root.contains(cell) ? cell : null;
};

const TABLE_ACTIONS = [
  { action: 'insertRowBelow', label: '행 추가' },
  { action: 'insertColumnRight', label: '열 추가' },
  { action: 'deleteRow', label: '행 삭제' },
  { action: 'deleteColumn', label: '열 삭제' },
  { action: 'deleteTable', label: '표 삭제', danger: true },
];

const applyTableWidth = (table, width) => {
  if (!table || !Number.isFinite(width)) return;
  const roundedWidth = Math.round(width);
  const widthValue = `${roundedWidth}px`;
  if (table.style.width !== widthValue) {
    table.style.width = widthValue;
  }
  if (table.getAttribute('width') !== String(roundedWidth)) {
    table.setAttribute('width', String(roundedWidth));
  }
};

const applyTableOffset = (table, offset) => {
  if (!table || !Number.isFinite(offset)) return;
  const roundedOffset = Math.max(Math.round(offset), 0);
  const offsetValue = `${roundedOffset}px`;
  if (table.style.marginLeft !== offsetValue) {
    table.style.marginLeft = offsetValue;
  }
};

const getTableIndex = (root, table) => Array.from(root.querySelectorAll('table')).indexOf(table);

const rememberTableWidth = (tableWidths, tableIndex, width) => {
  if (tableIndex >= 0 && Number.isFinite(width)) {
    tableWidths.set(tableIndex, Math.round(width));
  }
};

const rememberTableOffset = (tableOffsets, tableIndex, offset) => {
  if (tableIndex >= 0 && Number.isFinite(offset)) {
    tableOffsets.set(tableIndex, Math.max(Math.round(offset), 0));
  }
};

const getSelectionCell = (root) => {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return findCellFromTarget(root, element);
};

const setCaretAfterNode = (node) => {
  const selection = window.getSelection?.();
  if (!selection) return;

  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const insertLineBreakAtCellEnd = (cell) => {
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);

  const lineBreak = document.createTextNode('\n');
  range.insertNode(lineBreak);
  setCaretAfterNode(lineBreak);
};

export const setupTableResizing = ({ root, editor, onResize } = {}) => {
  if (typeof window === 'undefined' || !root) {
    return () => {};
  }

  const container = root.parentElement || root;
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = RESIZE_HANDLE_CLASS;
  handle.setAttribute('aria-label', '표 크기 조절');
  handle.hidden = true;
  container.appendChild(handle);

  const moveHandle = document.createElement('button');
  moveHandle.type = 'button';
  moveHandle.className = MOVE_HANDLE_CLASS;
  moveHandle.setAttribute('aria-label', '표 좌우 이동');
  moveHandle.hidden = true;
  container.appendChild(moveHandle);

  const menu = document.createElement('div');
  menu.className = TABLE_MENU_CLASS;
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  menu.innerHTML = TABLE_ACTIONS.map(
    ({ action, label, danger }) =>
      `<button type="button" role="menuitem" data-action="${action}"${
        danger ? ' data-danger="true"' : ''
      }>${label}</button>`,
  ).join('');
  container.appendChild(menu);

  let activeTable = null;
  let activeCell = null;
  let resizeState = null;
  let moveState = null;
  let rafId = null;
  const tableWidths = new Map();
  const tableOffsets = new Map();

  const reapplyStoredWidths = () => {
    root.querySelectorAll('table').forEach((table, index) => {
      const storedWidth = tableWidths.get(index);
      if (storedWidth) {
        applyTableWidth(table, storedWidth);
      }
      const storedOffset = tableOffsets.get(index);
      if (Number.isFinite(storedOffset)) {
        applyTableOffset(table, storedOffset);
      }
    });
  };

  const scheduleContentSync = () => {
    window.requestAnimationFrame(() => {
      reapplyStoredWidths();
      onResize?.(root.innerHTML);
      schedulePosition();
    });
  };

  const hideHandle = () => {
    if (resizeState || moveState) return;
    activeTable = null;
    activeCell = null;
    handle.hidden = true;
    moveHandle.hidden = true;
    menu.hidden = true;
  };

  const hideMenu = () => {
    menu.hidden = true;
  };

  const positionHandle = () => {
    if (!activeTable || !container.contains(activeTable)) {
      hideHandle();
      return;
    }

    const tableRect = activeTable.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    handle.hidden = false;
    handle.style.left = `${tableRect.right - containerRect.left + container.scrollLeft - 9}px`;
    handle.style.top = `${tableRect.top - containerRect.top + container.scrollTop - 12}px`;

    moveHandle.hidden = false;
    moveHandle.style.left = `${tableRect.right - containerRect.left + container.scrollLeft - 9}px`;
    moveHandle.style.top = `${tableRect.bottom - containerRect.top + container.scrollTop + 5}px`;
  };

  const schedulePosition = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      positionHandle();
    });
  };

  const showHandle = (table) => {
    if (!table) {
      hideHandle();
      return;
    }

    activeTable = table;
    schedulePosition();
  };

  const positionMenu = (event) => {
    const containerRect = container.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      Math.max(event.clientX - containerRect.left + container.scrollLeft, margin),
      containerRect.width - menuRect.width - margin,
    );
    const top = Math.min(
      Math.max(event.clientY - containerRect.top + container.scrollTop + margin, margin),
      containerRect.height - menuRect.height - margin,
    );

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  const showActionMenu = (event, table, cell) => {
    activeTable = table;
    activeCell = cell;
    menu.hidden = false;
    positionMenu(event);
    schedulePosition();
  };

  const selectActiveCell = () => {
    if (!editor || !activeCell) return false;
    const cellBlot = editor.constructor?.find?.(activeCell);
    if (!cellBlot || typeof editor.getIndex !== 'function') return false;

    const index = editor.getIndex(cellBlot);
    editor.setSelection(index, 0, 'silent');
    return true;
  };

  const syncEditorContent = () => {
    editor?.update?.('user');
    scheduleContentSync();
  };

  const syncResizedTable = (table, width, fallbackIndex = -1) => {
    editor?.update?.('user');
    const tableIndex = getTableIndex(root, table);
    const resolvedIndex = tableIndex >= 0 ? tableIndex : fallbackIndex;
    rememberTableWidth(tableWidths, resolvedIndex, width);
    applyTableWidth(table, width);
    scheduleContentSync();
  };

  const syncMovedTable = (table, offset, fallbackIndex = -1) => {
    editor?.update?.('user');
    const tableIndex = getTableIndex(root, table);
    const resolvedIndex = tableIndex >= 0 ? tableIndex : fallbackIndex;
    rememberTableOffset(tableOffsets, resolvedIndex, offset);
    applyTableOffset(table, offset);
    scheduleContentSync();
  };

  const handleRootPointerDown = (event) => {
    const table = findTableFromTarget(root, event.target);
    if (table) {
      showHandle(table);
      if (event.ctrlKey || event.metaKey) {
        const cell = findCellFromTarget(root, event.target);
        if (cell) {
          event.preventDefault();
          event.stopPropagation();
          showActionMenu(event, table, cell);
        }
      } else {
        hideMenu();
      }
      return;
    }

    if (event.target !== handle && event.target !== moveHandle) {
      hideHandle();
    }
  };

  const handleDocumentPointerDown = (event) => {
    if (
      root.contains(event.target) ||
      handle.contains(event.target) ||
      moveHandle.contains(event.target) ||
      menu.contains(event.target)
    ) {
      return;
    }
    hideHandle();
  };

  const handleRootFocusIn = (event) => {
    showHandle(findTableFromTarget(root, event.target));
  };

  const handleRootContextMenu = (event) => {
    if ((event.ctrlKey || event.metaKey) && findTableFromTarget(root, event.target)) {
      event.preventDefault();
    }
  };

  const handleTableEnter = (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;

    const cell = getSelectionCell(root);
    if (!cell) return;

    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    insertLineBreakAtCellEnd(cell);
    scheduleContentSync();
  };

  const handleResizePointerMove = (event) => {
    if (!resizeState) return;

    const deltaX = event.clientX - resizeState.startX;
    const nextWidth = Math.min(
      Math.max(resizeState.startWidth + deltaX, MIN_TABLE_WIDTH),
      resizeState.maxWidth,
    );
    rememberTableWidth(tableWidths, resizeState.tableIndex, nextWidth);
    applyTableWidth(resizeState.table, nextWidth);
    resizeState.lastWidth = nextWidth;
    schedulePosition();
  };

  const finishResize = () => {
    if (!resizeState) return;

    syncResizedTable(
      resizeState.table,
      resizeState.lastWidth || resizeState.startWidth,
      resizeState.tableIndex,
    );
    resizeState = null;
    const pointerId = Number(handle.dataset.pointerId);
    if (Number.isInteger(pointerId)) {
      handle.releasePointerCapture?.(pointerId);
    }
    delete handle.dataset.pointerId;
    schedulePosition();
  };

  const handleResizePointerDown = (event) => {
    if (!activeTable || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const tableRect = activeTable.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    handle.dataset.pointerId = String(event.pointerId);
    handle.setPointerCapture?.(event.pointerId);
    resizeState = {
      table: activeTable,
      tableIndex: getTableIndex(root, activeTable),
      startX: event.clientX,
      startWidth: tableRect.width,
      lastWidth: tableRect.width,
      maxWidth: Math.max(rootRect.width, MIN_TABLE_WIDTH),
    };
  };

  const handleMovePointerMove = (event) => {
    if (!moveState) return;

    const deltaX = event.clientX - moveState.startX;
    const nextOffset = Math.min(
      Math.max(moveState.startOffset + deltaX, 0),
      moveState.maxOffset,
    );
    rememberTableOffset(tableOffsets, moveState.tableIndex, nextOffset);
    applyTableOffset(moveState.table, nextOffset);
    moveState.lastOffset = nextOffset;
    schedulePosition();
  };

  const finishMove = () => {
    if (!moveState) return;

    syncMovedTable(
      moveState.table,
      moveState.lastOffset ?? moveState.startOffset,
      moveState.tableIndex,
    );
    moveState = null;
    const pointerId = Number(moveHandle.dataset.pointerId);
    if (Number.isInteger(pointerId)) {
      moveHandle.releasePointerCapture?.(pointerId);
    }
    delete moveHandle.dataset.pointerId;
    schedulePosition();
  };

  const handleMovePointerDown = (event) => {
    if (!activeTable || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const tableRect = activeTable.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const inlineOffset = Number.parseFloat(activeTable.style.marginLeft);
    const fallbackOffset = tableRect.left - rootRect.left + root.scrollLeft;
    const startOffset = Number.isFinite(inlineOffset) ? inlineOffset : Math.max(fallbackOffset, 0);
    const maxOffset = Math.max(root.clientWidth - tableRect.width, 0);
    moveHandle.dataset.pointerId = String(event.pointerId);
    moveHandle.setPointerCapture?.(event.pointerId);
    moveState = {
      table: activeTable,
      tableIndex: getTableIndex(root, activeTable),
      startX: event.clientX,
      startOffset,
      lastOffset: startOffset,
      maxOffset,
    };
  };

  const handleMenuClick = (event) => {
    const button = event.target.closest?.('button[data-action]');
    if (!button || !menu.contains(button)) return;

    event.preventDefault();
    event.stopPropagation();

    if (!selectActiveCell()) return;

    const tableModule = editor?.getModule?.('table');
    const action = button.dataset.action;
    if (tableModule && typeof tableModule[action] === 'function') {
      tableModule[action]();
    }

    if (action === 'deleteTable') {
      hideHandle();
    } else {
      hideMenu();
      showHandle(activeTable);
    }
    syncEditorContent();
  };

  root.addEventListener('pointerdown', handleRootPointerDown, true);
  root.addEventListener('keydown', handleTableEnter, true);
  root.addEventListener('focusin', handleRootFocusIn);
  root.addEventListener('contextmenu', handleRootContextMenu, true);
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
  handle.addEventListener('pointerdown', handleResizePointerDown);
  handle.addEventListener('pointermove', handleResizePointerMove);
  handle.addEventListener('pointerup', finishResize);
  handle.addEventListener('pointercancel', finishResize);
  moveHandle.addEventListener('pointerdown', handleMovePointerDown);
  moveHandle.addEventListener('pointermove', handleMovePointerMove);
  moveHandle.addEventListener('pointerup', finishMove);
  moveHandle.addEventListener('pointercancel', finishMove);
  document.addEventListener('pointermove', handleResizePointerMove);
  document.addEventListener('pointerup', finishResize);
  document.addEventListener('pointercancel', finishResize);
  document.addEventListener('pointermove', handleMovePointerMove);
  document.addEventListener('pointerup', finishMove);
  document.addEventListener('pointercancel', finishMove);
  menu.addEventListener('click', handleMenuClick);
  window.addEventListener('resize', schedulePosition);
  root.addEventListener('scroll', schedulePosition);

  const mutationObserver = new MutationObserver(() => {
    reapplyStoredWidths();
    schedulePosition();
  });
  mutationObserver.observe(root, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  return () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    root.removeEventListener('pointerdown', handleRootPointerDown, true);
    root.removeEventListener('keydown', handleTableEnter, true);
    root.removeEventListener('focusin', handleRootFocusIn);
    root.removeEventListener('contextmenu', handleRootContextMenu, true);
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    handle.removeEventListener('pointerdown', handleResizePointerDown);
    handle.removeEventListener('pointermove', handleResizePointerMove);
    handle.removeEventListener('pointerup', finishResize);
    handle.removeEventListener('pointercancel', finishResize);
    moveHandle.removeEventListener('pointerdown', handleMovePointerDown);
    moveHandle.removeEventListener('pointermove', handleMovePointerMove);
    moveHandle.removeEventListener('pointerup', finishMove);
    moveHandle.removeEventListener('pointercancel', finishMove);
    document.removeEventListener('pointermove', handleResizePointerMove);
    document.removeEventListener('pointerup', finishResize);
    document.removeEventListener('pointercancel', finishResize);
    document.removeEventListener('pointermove', handleMovePointerMove);
    document.removeEventListener('pointerup', finishMove);
    document.removeEventListener('pointercancel', finishMove);
    menu.removeEventListener('click', handleMenuClick);
    window.removeEventListener('resize', schedulePosition);
    root.removeEventListener('scroll', schedulePosition);
    mutationObserver.disconnect();
    handle.remove();
    moveHandle.remove();
    menu.remove();
  };
};
