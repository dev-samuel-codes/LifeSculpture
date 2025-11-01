// src/components/QuillToolbar.js
import { useMemo, useCallback, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ReactQuill from 'react-quill-new';

// katex를 전역 객체에 할당
window.katex = katex;

let quillFormatsRegistered = false;

const registerQuillFormats = () => {
  if (quillFormatsRegistered) return;

  const Quill = ReactQuill?.Quill;
  if (!Quill || typeof Quill.import !== 'function') {
    return;
  }

  try {
    const Font = Quill.import('formats/font');
    const Size = Quill.import('formats/size');

    if (Font) {
      Font.whitelist = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', '맑은 고딕', '나눔고딕', '나눔바른고딕'];
      Quill.register(Font, true);
    }

    if (Size) {
      Size.whitelist = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72'];
      Quill.register(Size, true);
    }

    quillFormatsRegistered = true;
  } catch (error) {
    console.warn('Quill 포맷 등록 중 오류:', error);
  }
};

const showTableSizeModal = () => {
  return new Promise((resolve, reject) => {
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
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.28);
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
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.25);
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
          box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
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
};

// Quill 핸들러 모듈 초기화 함수
const initializeQuillHandlers = () => {
  try {
    const Quill = ReactQuill?.Quill;
    if (Quill && typeof Quill.register === 'function') {
      // 핸들러 모듈이 존재하지 않으면 빈 모듈로 등록
      if (!Quill.imports || !Quill.imports['modules/handlers']) {
        const HandlersModule = {
          handlers: {},
          addHandler: function(format, handler) {
            this.handlers[format] = handler;
          },
          getHandler: function(format) {
            return this.handlers[format];
          }
        };
        Quill.register('modules/handlers', HandlersModule, true);
        console.log('Quill handlers 모듈 등록 완료');
      }
    } else {
      console.warn('Quill 인스턴스를 찾을 수 없거나 register 메서드가 없습니다.');
    }
  } catch (error) {
    console.warn('Quill handlers 모듈 초기화 중 오류:', error);
  }
};

// 이미지 압축 함수 - KB 단위로 압축
const compressImage = (file) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // 원본 이미지 크기
      let { width, height } = img;
      
      // 원본 파일 크기에 따른 압축 목표 설정
      const originalSizeMB = file.size / (1024 * 1024);
      let targetSizeKB;
      
      if (originalSizeMB > 10) {
        targetSizeKB = 100; // 10MB 이상이면 100KB로 압축
      } else if (originalSizeMB > 5) {
        targetSizeKB = 200; // 5MB 이상이면 200KB로 압축
      } else if (originalSizeMB > 2) {
        targetSizeKB = 300; // 2MB 이상이면 300KB로 압축
      } else if (originalSizeMB > 1) {
        targetSizeKB = 400; // 1MB 이상이면 400KB로 압축 (더 강력하게)
      } else {
        targetSizeKB = 600; // 1MB 미만이면 600KB로 압축
      }
      
      console.log(`[COMPRESS] 원본: ${originalSizeMB.toFixed(1)}MB, 목표: ${targetSizeKB}KB`);
      
      // 더 강력한 리사이즈 적용
      let maxDimension = 1920;
      if (originalSizeMB > 5) {
        maxDimension = 1280; // 5MB 이상이면 더 작게
      } else if (originalSizeMB > 2) {
        maxDimension = 1600; // 2MB 이상이면 중간 크기
      }
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
        console.log(`[COMPRESS] 리사이즈: ${width}x${height}`);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height);
      
      // 더 강력한 압축을 위한 품질 조정
      let quality = 0.8; // 시작 품질을 낮춤
      
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          const currentSizeKB = blob.size / 1024;
          console.log(`[COMPRESS] 시도: ${currentSizeKB.toFixed(1)}KB (품질: ${quality.toFixed(1)})`);
          
          if (blob.size <= targetSizeKB * 1024 || quality <= 0.05) {
            // 압축된 이미지가 목표 크기 이하이거나 최소 품질에 도달
            console.log(`[COMPRESS] 완료: ${currentSizeKB.toFixed(1)}KB (목표: ${targetSizeKB}KB)`);
            resolve(blob);
          } else {
            // 품질을 더 빠르게 낮춤
            quality -= 0.15;
            if (quality < 0.05) quality = 0.05;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };
      
      tryCompress();
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// 이미지 업로드 함수 (Hook이 아닌 일반 함수)
export const handleImageUpload = async (file) => {
  console.log('[handleImageUpload] start with file:', file);
  
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error('[handleImageUpload] no user found');
    alert('로그인이 필요합니다. 관리자 계정으로 로그인 후 다시 시도하세요.');
    return null;
  }
  if (!file) {
    console.error('[handleImageUpload] no file provided');
    return null;
  }

  const MAX_MB = 15;
  if (!file.type?.startsWith('image/')) {
    console.error('[handleImageUpload] invalid file type:', file.type);
    alert('이미지 파일만 업로드할 수 있어요.');
    return null;
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    console.error('[handleImageUpload] file too large:', file.size);
    alert(`이미지 용량이 큽니다. 최대 ${MAX_MB}MB까지 업로드할 수 있어요.`);
    return null;
  }

  try {
    console.log('[UPLOAD] start:', {
      name: file.name,
      size: file.size,
      type: file.type,
      bucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
      uid: user.uid,
    });

    // 이미지 압축 - 1MB 이상인 경우에만 적용
    let processedFile = file;
    const originalSizeKB = file.size / 1024;
    const originalSizeMB = file.size / (1024 * 1024);
    
    if (originalSizeMB >= 1) {
      console.log(`[COMPRESS] 1MB 이상 감지: ${originalSizeMB.toFixed(1)}MB, 압축 시작`);
      console.log('[COMPRESS] compressing image...');
      processedFile = await compressImage(file);
      const compressedSizeKB = processedFile.size / 1024;
      console.log(`[COMPRESS] 압축 완료: ${compressedSizeKB.toFixed(1)}KB (압축률: ${((1 - processedFile.size / file.size) * 100).toFixed(1)}%)`);
    } else {
      console.log(`[COMPRESS] 1MB 미만: ${originalSizeKB.toFixed(1)}KB, 압축 생략`);
    }

    // Storage 경로 설정 및 업로드
    const path = `post-images/${Date.now()}-${file.name}`;
    console.log('[STORAGE] 업로드 경로:', path);
    console.log('[STORAGE] Storage 참조 생성 중...');
    
    const imgRef = storageRef(storage, path);
    console.log('[STORAGE] Storage 참조 생성 완료:', imgRef);
    
    const metadata = { contentType: processedFile.type || 'image/jpeg' };
    console.log('[STORAGE] 메타데이터:', metadata);
    
    console.log('[STORAGE] 이미지 업로드 시작...');
    const snap = await uploadBytes(imgRef, processedFile, metadata);
    console.log('[STORAGE] 업로드 완료:', {
      fullPath: snap.metadata.fullPath,
      contentType: snap.metadata.contentType,
      size: snap.metadata.size,
      bucket: snap.metadata.bucket,
    });

    console.log('[STORAGE] 다운로드 URL 생성 중...');
    const url = await getDownloadURL(snap.ref);
    console.log('[STORAGE] 다운로드 URL 생성 완료:', url);
    
    if (!url) {
      console.error('[STORAGE] 다운로드 URL이 생성되지 않음');
      throw new Error('다운로드 URL 생성 실패');
    }
    
    console.log('[UPLOAD] 전체 과정 완료. 반환할 URL:', url);
    return url;
  } catch (err) {
    console.error('[UPLOAD] 전체 과정 실패:', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    
    // Storage 관련 에러 상세 분석
    if (err?.code === 'storage/unauthorized' || err?.code === 'permission-denied') {
      alert('이미지 업로드 권한이 없습니다. 관리자 계정인지 확인하세요.');
    } else if (err?.code === 'storage/bucket-not-found') {
      alert('Storage 버킷을 찾을 수 없습니다. Firebase 설정을 확인하세요.');
    } else if (err?.code === 'storage/object-not-found') {
      alert('Storage 객체를 찾을 수 없습니다. 업로드가 실패했을 수 있습니다.');
    } else if (err?.code === 'storage/quota-exceeded') {
      alert('Storage 용량이 초과되었습니다.');
    } else if (err?.code === 'storage/unauthenticated') {
      alert('인증되지 않은 사용자입니다. 로그인 후 다시 시도하세요.');
    } else {
      alert(`이미지 업로드에 실패했습니다: ${err.message}\n\n콘솔의 [UPLOAD] failed 로그를 확인해주세요.`);
    }
    throw err;
  }
};

// Quill 이미지 핸들러
export const useImageHandler = () => {
  return useCallback(() => {
    console.log('[imageHandler] called - 이미지 핸들러 시작');
    
    // 에디터 참조 가져오기 (여러 방법 시도)
    let editor = null;
    if (window.quillEditor) {
      editor = window.quillEditor;
      console.log('[imageHandler] window.quillEditor에서 에디터 찾음');
      
      // 에디터 인스턴스에 직접 이미지 핸들러 등록
      try {
        if (editor && editor.getModule) {
          const toolbar = editor.getModule('toolbar');
          if (toolbar && toolbar.addHandler) {
            toolbar.addHandler('image', () => {
              console.log('[toolbar] 이미지 핸들러가 툴바에서 호출됨');
            });
          }
        }
      } catch (error) {
        console.warn('툴바 핸들러 등록 중 오류:', error);
      }
    } else {
      // DOM에서 직접 찾기
      const quillElement = document.querySelector('.ql-editor');
      if (quillElement && quillElement.__quill) {
        editor = quillElement.__quill;
        console.log('[imageHandler] DOM에서 에디터 찾음');
      }
    }
    
    if (!editor) {
      console.error('[imageHandler] editor not found, trying to find...');
      // 약간의 지연 후 다시 시도
      setTimeout(() => {
        if (window.quillEditor) {
          console.log('[imageHandler] editor found after delay');
        } else {
          alert('에디터가 준비되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
          return;
        }
      }, 500);
      return;
    }

    console.log('[imageHandler] 파일 선택 다이얼로그 열기');
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      console.log('[imageHandler] onchange - 파일 선택됨');
      const file = input.files && input.files[0];
      if (!file) {
        console.log('[imageHandler] no file selected');
        return;
      }

      console.log('[imageHandler] 선택된 파일 정보:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      try {
        console.log('[imageHandler] handleImageUpload 호출 시작');
        const url = await handleImageUpload(file);
        console.log('[imageHandler] handleImageUpload 완료, URL:', url);
        
        if (!url) {
          console.error('[imageHandler] no URL returned');
          return;
        }

        // 에디터 참조 다시 확인
        let currentEditor = window.quillEditor;
        if (!currentEditor) {
          const quillElement = document.querySelector('.ql-editor');
          if (quillElement && quillElement.__quill) {
            currentEditor = quillElement.__quill;
          }
        }

        if (currentEditor) {
          const range = currentEditor.getSelection(true) || { index: currentEditor.getLength() };
          console.log('[imageHandler] 이미지 삽입 위치:', range.index);
          
          // 현재 선택된 블록의 정렬 상태 확인
          const [line] = currentEditor.getLine(range.index);
          const formats = line ? line.formats() : {};
          const currentAlign = formats.align || '';
          
          // 이미지 삽입
          currentEditor.insertEmbed(range.index, 'image', url, 'user');
          
          // 정렬이 설정되어 있다면 이미지에도 적용
          if (currentAlign) {
            // 이미지 삽입 후 정렬 적용
            setTimeout(() => {
              const newRange = { index: range.index, length: 1 };
              currentEditor.formatLine(newRange.index, newRange.length, 'align', currentAlign);
              console.log('[imageHandler] 이미지 정렬 적용:', currentAlign);
            }, 10);
          }
          
          currentEditor.setSelection(range.index + 1, 0);
          console.log('[imageHandler] 이미지 삽입 성공');
        } else {
          console.error('[imageHandler] editor still not found after upload');
          alert('에디터를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        }
      } catch (err) {
        console.error('[imageHandler] 이미지 업로드 실패:', err);
        alert('이미지 삽입에 실패했습니다: ' + err.message);
      }
    };
  }, []);
};

// 테이블 삽입 핸들러 (제거됨 - Quill 기본 테이블 모듈이 없음)
// export const useTableHandler = () => {
//   return useCallback(() => {
//     const editor = window.quillEditor;
//     if (editor) {
//       const range = editor.getSelection(true) || { index: editor.getLength() };
//       editor.insertTable(3, 3, range.index);
//       editor.setSelection(range.index + 1, 0);
//     } else {
//       console.error('[tableHandler] editor not found');
//       alert('에디터가 준비되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
//     }
//   }, []);
// };

// 네이버 블로그 수준의 고급 툴바 설정
export const useQuillModules = () => {
  return useMemo(
    () => {
      try {
        // Quill 핸들러 모듈 초기화
        initializeQuillHandlers();
        registerQuillFormats();

        const tableHandler = async function() {
          try {
            const quillInstance = this?.quill || window.quillEditor;
            if (!quillInstance) {
              console.error('[tableHandler] Quill editor instance not found.');
              alert('에디터가 준비되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
              return;
            }

            const tableModule = quillInstance.getModule('table');
            if (!tableModule || typeof tableModule.insertTable !== 'function') {
              console.error('[tableHandler] Table module is unavailable.');
              alert('현재 테이블 기능을 사용할 수 없습니다.');
              return;
            }

            const size = await showTableSizeModal().catch(() => null);
            if (!size) {
              return;
            }

            const range = quillInstance.getSelection(true);
            const insertIndex = range ? range.index : quillInstance.getLength();
            quillInstance.setSelection(insertIndex, 0);
            tableModule.insertTable(size.rows, size.cols);
            quillInstance.setSelection(insertIndex, 0);
          } catch (error) {
            console.error('[tableHandler] 테이블 삽입 실패:', error);
            alert('테이블을 삽입하는 중 오류가 발생했습니다.');
          }
        };

        const handleTableDeletion = (quillInstance, range, direction = 'backward') => {
          try {
            if (!quillInstance || !range) {
              return true;
            }

            if (direction === 'backward' && range.index === 0) {
              return true;
            }

            const QuillConstructor = ReactQuill?.Quill;
            if (!QuillConstructor) {
              return true;
            }

            const tableModule = quillInstance.getModule('table');

            const findTableElement = () => {
              const nodes = new Set();
              const domSelection = typeof document !== 'undefined' ? document.getSelection() : null;
              if (domSelection) {
                if (domSelection.anchorNode) nodes.add(domSelection.anchorNode);
                if (domSelection.focusNode) nodes.add(domSelection.focusNode);
              }

              const addNodeFromLeaf = (index) => {
                if (index < 0 || index >= quillInstance.getLength()) return;
                const [leaf] = quillInstance.getLeaf(index);
                if (leaf?.domNode) nodes.add(leaf.domNode);
              };

              const addNodeFromLine = (index) => {
                const [line] = quillInstance.getLine(index);
                if (line?.domNode) nodes.add(line.domNode);
              };

              addNodeFromLeaf(range.index);
              addNodeFromLeaf(range.index - 1);
              addNodeFromLeaf(range.index + 1);
              addNodeFromLine(range.index);
              addNodeFromLine(range.index - 1);

              const root = quillInstance.root;
              for (const node of nodes) {
                let el = node;
                while (el && el !== root) {
                  if (el.nodeType === Node.ELEMENT_NODE && el.nodeName === 'TABLE') {
                    return el;
                  }
                  el = el.parentElement;
                }
              }

              return null;
            };

            const removeTableElement = (tableElement) => {
              if (!tableElement) return false;
              const tableBlot = QuillConstructor.find?.(tableElement);
              if (tableBlot && typeof tableBlot.remove === 'function') {
                tableBlot.remove();
              } else {
                tableElement.remove();
              }
              quillInstance.update('user');
              const cursor = Math.max(Math.min(range.index - (direction === 'backward' ? 1 : 0), quillInstance.getLength() - 1), 0);
              quillInstance.setSelection(cursor, 0, QuillConstructor.sources?.SILENT ?? 'silent');
              const char = quillInstance.getText(cursor, 1);
              if (char === '\n') {
                quillInstance.deleteText(cursor, 1, 'user');
                quillInstance.setSelection(Math.max(cursor - 1, 0), 0, QuillConstructor.sources?.SILENT ?? 'silent');
              }
              return true;
            };

            if (range.length > 0 && tableModule) {
              const delta = quillInstance.getContents(range.index, range.length);
              const hasTable = delta.ops?.some(op => {
                const attrs = op?.attributes || {};
                return Object.keys(attrs).some(key => key.startsWith('table'));
              });
              if (hasTable) {
                const tableElement = findTableElement();
                if (removeTableElement(tableElement)) {
                  return false;
                }
              }
            }

            if (tableModule) {
              const moveIndex = direction === 'backward' ? Math.max(range.index - 1, 0) : range.index;
              const [leaf] = quillInstance.getLeaf(moveIndex);
              if (leaf) {
                const cellDom = leaf.domNode?.closest?.('td, th');
                if (cellDom) {
                  const cellBlot = QuillConstructor.find?.(cellDom);
                  if (cellBlot) {
                    const cellIndex = quillInstance.getIndex(cellBlot);
                    quillInstance.setSelection(cellIndex, 0, QuillConstructor.sources?.SILENT ?? 'silent');
                    if (typeof tableModule.deleteTable === 'function') {
                      tableModule.deleteTable();
                      quillInstance.update('user');
                      return false;
                    }
                  }
                }
              }
            }

            const tableElement = findTableElement();
            if (removeTableElement(tableElement)) {
              return false;
            }

            return true;
          } catch (error) {
            console.warn('[tableHandler] 테이블 삭제 처리 실패:', error);
            return true;
          }
        };

        return {
          toolbar: {
            container: [
              // 1행: 제목 스타일, 폰트, 크기
              [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
              [{ 'font': ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', '맑은 고딕', '나눔고딕', '나눔바른고딕'] }],
              [{ 'size': ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72'] }],
              
              // 2행: 텍스트 스타일
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'script': 'sub' }, { 'script': 'super' }],
              
              // 3행: 문단 스타일
              ['blockquote', 'code-block'],
              [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
              [{ 'align': ['justify', 'left', 'center', 'right', ''] }],

              // 4행: 미디어 및 고급 기능
              ['link', 'image', 'video', 'formula', 'table'],
              
              // 5행: 특수 기능
              ['clean'],
            ],
            handlers: {
              'formula': function() {
                const editor = window.quillEditor;
                if (!editor) {
                  console.error('Quill editor instance not found.');
                  return;
                }
                
                const range = editor.getSelection();
                let existingFormula = '';
                if (range && range.length > 0) {
                    const selection = editor.getContents(range.index, range.length);
                    if (selection.ops[0]?.insert?.formula) {
                        existingFormula = selection.ops[0].insert.formula;
                    }
                }

                if (typeof window.openFormulaEditor === 'function') {
                  window.openFormulaEditor(existingFormula, (newFormula) => {
                    const currentRange = editor.getSelection(true);
                    if (range && range.length > 0) {
                        editor.deleteText(range.index, range.length);
                    }
                    editor.insertEmbed(currentRange.index, 'formula', newFormula, 'user');
                    editor.setSelection(currentRange.index + 1, 0);
                  });
                } else {
                  console.error('Custom formula editor handler (window.openFormulaEditor) is not defined.');
                  const value = prompt('Enter formula:', existingFormula);
                  if (value) {
                    editor.insertEmbed(range.index, 'formula', value, 'user');
                  }
                }
              },
              table: tableHandler
            }
          },
          // 핸들러를 직접 설정하지 않고, 에디터 인스턴스에서 설정
          // handlers: { 
          //   image: imageHandler, 
          // },
          table: true,
          clipboard: { 
            matchVisual: false
          },
          keyboard: {
            bindings: {
              tab: {
                key: 9,
                handler: function() {
                  return true;
                }
              },
              'ctrl+b': {
                key: 66,
                ctrlKey: true,
                handler: function(range, context) {
                  this.quill.format('bold', !this.quill.getFormat(range).bold);
                }
              },
              'ctrl+i': {
                key: 73,
                ctrlKey: true,
                handler: function(range, context) {
                  this.quill.format('italic', !this.quill.getFormat(range).italic);
                }
              },
              'ctrl+u': {
                key: 85,
                ctrlKey: true,
                handler: function(range, context) {
                  this.quill.format('underline', !this.quill.getFormat(range).underline);
                }
              },
              deleteTableBackward: {
                key: 'backspace',
                handler: function(range) {
                  return handleTableDeletion(this.quill, range, 'backward');
                }
              },
              deleteTableForward: {
                key: 'delete',
                handler: function(range) {
                  return handleTableDeletion(this.quill, range, 'forward');
                }
              },
              tableEnter: {
                key: 13,
                handler: function(range, context) {
                  const quillInstance = this.quill;
                  if (!quillInstance || !range) {
                    return true;
                  }

                  const currentFormat = quillInstance.getFormat(range.index, range.length);
                  const previousFormat = range.index > 0 ? quillInstance.getFormat(range.index - 1, 1) : null;
                  const relevantKeys = ['table', 'table-cell-line', 'table-header-cell', 'table-body-cell'];
                  const hasTableContext = relevantKeys.some((key) => currentFormat?.[key] || previousFormat?.[key]);

                  if (!hasTableContext) {
                    return true;
                  }

                  const appliedFormat = { ...currentFormat };
                  relevantKeys.forEach((key) => {
                    if (!appliedFormat[key] && previousFormat && previousFormat[key]) {
                      appliedFormat[key] = previousFormat[key];
                    }
                  });

                  quillInstance.insertText(range.index, '\n', appliedFormat, 'user');
                  quillInstance.setSelection(range.index + 1, 0, ReactQuill?.Quill?.sources?.SILENT ?? 'silent');
                  return false;
                }
              }
            }
          },
          history: {
            delay: 1000,
            maxStack: 500,
            userOnly: true
          }
        };
      } catch (error) {
        console.error('Quill 모듈 설정 중 오류 발생:', error);
        // 기본 모듈 설정 반환
        return {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'image'],
            ['clean']
          ]
        };
      }
    },
    [] // imageHandler 의존성 제거
  );
};

// 확장된 Quill 포맷 설정 (지원되는 포맷만 포함)
export const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'script',
  'blockquote', 'code-block',
  'list', 'indent',
  'direction', 'align',
  'link', 'image', 'video', 'formula',
  'table'
];

// 툴바 설정을 위한 커스텀 훅
export const useQuillToolbar = () => {
  // 컴포넌트 마운트 시 Quill 핸들러 모듈 초기화
  useEffect(() => {
    try {
      initializeQuillHandlers();
    } catch (error) {
      console.warn('Quill 핸들러 초기화 중 오류:', error);
    }
  }, []);

  const imageHandler = useImageHandler();
  const modules = useQuillModules(); // imageHandler 매개변수 제거

  return {
    modules,
    formats: quillFormats,
    handleImageUpload,
    imageHandler,
  };
};
