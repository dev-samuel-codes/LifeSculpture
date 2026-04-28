// quillSetup utils: Quill 포맷 등록과 테이블 핸들러 초기화
import ReactQuill from 'react-quill-new';

let quillFormatsRegistered = false;

export const registerQuillFormats = () => {
  if (quillFormatsRegistered) return;

  const Quill = ReactQuill?.Quill;
  if (!Quill || typeof Quill.import !== 'function') {
    return;
  }

  try {
    const Font = Quill.import('formats/font');
    const Size = Quill.import('formats/size');

    if (Font) {
      Font.whitelist = [
        'arial',
        'times',
        'courier',
        'georgia',
        'verdana',
        'malgun',
        'nanum',
        'nanumbarun',
        'dongle',
      ];
      Quill.register(Font, true);
    }

    if (Size) {
      Size.whitelist = [
        '8',
        '9',
        '10',
        '11',
        '12',
        '14',
        '16',
        '18',
        '20',
        '22',
        '24',
        '26',
        '28',
        '36',
        '48',
        '72',
      ];
      Quill.register(Size, true);
    }

    quillFormatsRegistered = true;
  } catch (error) {
    console.warn('Quill 포맷 등록 중 오류:', error);
  }
};

export const initializeQuillHandlers = () => {
  try {
    const Quill = ReactQuill?.Quill;
    if (Quill && typeof Quill.register === 'function') {
      if (!Quill.imports || !Quill.imports['modules/handlers']) {
        const HandlersModule = {
          handlers: {},
          addHandler(format, handler) {
            this.handlers[format] = handler;
          },
          getHandler(format) {
            return this.handlers[format];
          },
        };
        Quill.register('modules/handlers', HandlersModule, true);
      }
    } else {
      console.warn('Quill 인스턴스를 찾을 수 없거나 register 메서드가 없습니다.');
    }
  } catch (error) {
    console.warn('Quill handlers 모듈 초기화 중 오류:', error);
  }
};

const TABLE_GRID_ROWS = 8;
const TABLE_GRID_COLS = 10;

export const showTableSizeModal = (anchorElement = null) =>
  new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document is not available.'));
      return;
    }

    const existing = document.getElementById('quill-table-modal');
    if (existing) {
      existing.remove();
    }

    const popover = document.createElement('div');
    popover.id = 'quill-table-modal';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', '테이블 크기 선택');
    popover.innerHTML = `
      <div class="qt-title" aria-live="polite">1x1 표</div>
      <div class="qt-grid" role="grid" aria-label="표 크기 선택"></div>
      <style>
        #quill-table-modal {
          position: fixed;
          z-index: 9999;
          width: 324px;
          padding: 12px;
          border: 1px solid var(--color-border-neutral, #e5e7eb);
          border-radius: 8px;
          background: var(--color-surface-default, #ffffff);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
          color: var(--color-text-strong, #2f3640);
          font-family: inherit;
        }
        #quill-table-modal .qt-title {
          margin: 0 0 10px;
          color: var(--color-text-heading, #1f2937);
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: 0;
        }
        #quill-table-modal .qt-grid {
          display: grid;
          grid-template-columns: repeat(10, 24px);
          gap: 6px;
        }
        #quill-table-modal .qt-cell {
          width: 24px;
          height: 24px;
          border: 1px solid var(--color-border-strong, #8b919b);
          border-radius: 2px;
          background: var(--color-surface-default, #ffffff);
          cursor: pointer;
          transition: background-color 0.08s ease, border-color 0.08s ease, box-shadow 0.08s ease;
        }
        #quill-table-modal .qt-cell.qt-selected {
          border-color: #3d7fe5;
          background: rgba(61, 127, 229, 0.12);
          box-shadow: inset 0 0 0 1px rgba(61, 127, 229, 0.26);
        }
        body[data-theme='dark'] #quill-table-modal {
          box-shadow: 0 22px 44px rgba(0, 0, 0, 0.42);
        }
        body[data-theme='dark'] #quill-table-modal .qt-cell {
          background: var(--color-surface-soft, #232e45);
          border-color: rgba(203, 213, 225, 0.46);
        }
        body[data-theme='dark'] #quill-table-modal .qt-cell.qt-selected {
          border-color: #6aa6ff;
          background: rgba(96, 165, 250, 0.24);
        }
      </style>
    `;

    const title = popover.querySelector('.qt-title');
    const grid = popover.querySelector('.qt-grid');

    const updateSelection = (rows, cols) => {
      if (title) {
        title.textContent = `${cols}x${rows} 표`;
      }
      grid?.querySelectorAll('.qt-cell').forEach((cell) => {
        const cellRows = Number(cell.dataset.rows);
        const cellCols = Number(cell.dataset.cols);
        cell.classList.toggle('qt-selected', cellRows <= rows && cellCols <= cols);
      });
    };

    for (let row = 1; row <= TABLE_GRID_ROWS; row += 1) {
      for (let col = 1; col <= TABLE_GRID_COLS; col += 1) {
        const rows = row;
        const cols = col;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'qt-cell';
        cell.dataset.rows = String(rows);
        cell.dataset.cols = String(cols);
        cell.setAttribute('aria-label', `${cols}x${rows} 표`);
        cell.addEventListener('mouseenter', () => updateSelection(rows, cols));
        cell.addEventListener('focus', () => updateSelection(rows, cols));
        cell.addEventListener('click', () => {
          cleanup();
          resolve({ rows, cols });
        });
        grid?.appendChild(cell);
      }
    }

    const cleanup = () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeydown);
      popover.remove();
    };

    const handleOutsideClick = (event) => {
      if (!popover.contains(event.target) && !anchorElement?.contains?.(event.target)) {
        cleanup();
        reject(new Error('cancel'));
      }
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        cleanup();
        reject(new Error('cancel'));
      }
    };

    const positionPopover = () => {
      const fallbackRect = {
        bottom: window.innerHeight / 2,
        left: window.innerWidth / 2 - 16,
      };
      const rect = anchorElement?.getBoundingClientRect?.() || fallbackRect;
      const popoverRect = popover.getBoundingClientRect();
      const margin = 8;
      const top = Math.min(rect.bottom + margin, window.innerHeight - popoverRect.height - margin);
      const left = Math.min(
        Math.max(rect.left, margin),
        window.innerWidth - popoverRect.width - margin,
      );
      popover.style.top = `${Math.max(top, margin)}px`;
      popover.style.left = `${left}px`;
    };

    document.body.appendChild(popover);
    updateSelection(1, 1);
    positionPopover();
    popover.querySelector('.qt-cell')?.focus();

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeydown);
  });
