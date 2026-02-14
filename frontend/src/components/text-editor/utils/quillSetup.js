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
        'Arial',
        'Times New Roman',
        'Courier New',
        'Georgia',
        'Verdana',
        '맑은 고딕',
        '나눔고딕',
        '나눔바른고딕',
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

export const showTableSizeModal = () =>
  new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document is not available.'));
      return;
    }

    const existing = document.getElementById('quill-table-modal');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'quill-table-modal';
    overlay.innerHTML = `
      <div class="qt-modal">
        <h3 class="qt-title">테이블 삽입</h3>
        <form class="qt-form">
          <div class="qt-field">
            <label for="qt-rows">행</label>
            <input id="qt-rows" name="rows" type="number" min="1" max="10" value="3" required />
          </div>
          <div class="qt-field">
            <label for="qt-cols">열</label>
            <input id="qt-cols" name="cols" type="number" min="1" max="10" value="3" required />
          </div>
          <div class="qt-actions">
            <button type="button" class="qt-btn qt-cancel">취소</button>
            <button type="submit" class="qt-btn qt-confirm">삽입</button>
          </div>
        </form>
      </div>
      <style>
        #quill-table-modal {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(2px);
        }
        #quill-table-modal .qt-modal {
          background: linear-gradient(145deg, #1f2937 0%, #0f172a 100%);
          border-radius: 12px;
          padding: 24px 28px;
          width: min(320px, 90vw);
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.196);
          font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
          color: #e5e7eb;
        }
        #quill-table-modal .qt-title {
          margin: 0 0 16px;
          font-size: 1.1rem;
          font-weight: 700;
          color: #ffffff;
          text-align: center;
        }
        #quill-table-modal .qt-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        #quill-table-modal .qt-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        #quill-table-modal label {
          font-size: 0.9rem;
          font-weight: 600;
          color: #e5e7eb;
        }
        #quill-table-modal input[type="number"] {
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          background: rgba(15, 23, 42, 0.65);
          color: #f8fafc;
        }
        #quill-table-modal input[type="number"]:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.175);
          background: rgba(17, 24, 39, 0.85);
        }
        #quill-table-modal .qt-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 6px;
        }
        #quill-table-modal .qt-btn {
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        #quill-table-modal .qt-cancel {
          background: rgba(55, 65, 81, 0.85);
          color: #e5e7eb;
        }
        #quill-table-modal .qt-confirm {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
        }
        #quill-table-modal .qt-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 16px rgba(15, 23, 42, 0.084);
        }
        #quill-table-modal .qt-btn:active {
          transform: translateY(0);
          box-shadow: none;
        }
        @media (prefers-color-scheme: dark) {
          #quill-table-modal .qt-modal {
            background: linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          }
        }
      </style>
    `;

    const form = overlay.querySelector('.qt-form');
    const cancelBtn = overlay.querySelector('.qt-cancel');
    const rowsInput = overlay.querySelector('#qt-rows');
    const colsInput = overlay.querySelector('#qt-cols');

    const cleanup = () => {
      overlay.removeEventListener('click', handleBackdropClick);
      document.removeEventListener('keydown', handleKeydown);
      overlay.remove();
    };

    const handleBackdropClick = (event) => {
      if (event.target === overlay) {
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

    overlay.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeydown);

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      reject(new Error('cancel'));
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const rows = parseInt(rowsInput?.value ?? '0', 10);
      const cols = parseInt(colsInput?.value ?? '0', 10);
      const inRange = (value) => Number.isInteger(value) && value >= 1 && value <= 10;

      if (!inRange(rows) || !inRange(cols)) {
        alert('행과 열은 1에서 10 사이의 숫자로 입력해주세요.');
        return;
      }

      cleanup();
      resolve({ rows, cols });
    });

    document.body.appendChild(overlay);
    rowsInput?.focus();
  });
