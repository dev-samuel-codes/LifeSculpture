// useQuillToolbar 훅: Quill 편집기의 모듈과 핸들러를 초기화
import { useEffect, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { handleImageUpload } from '../utils/imageUpload';
import {
  initializeQuillHandlers,
  registerQuillFormats,
  showTableSizeModal,
} from '../utils/quillSetup';

const ensureClipboardPreservesCodeIndent = (() => {
  let patched = false;

  const shouldPreserveCodeWhitespace = (node) => {
    if (typeof window === 'undefined' || !node || !node.parentElement) {
      return false;
    }
    const parentElement = node.parentElement;
    if (typeof parentElement.closest !== 'function') {
      return false;
    }
    return Boolean(parentElement.closest('.ql-code-block-container') || parentElement.closest('pre'));
  };

  return () => {
    if (patched || typeof window === 'undefined') return;
    const Quill = ReactQuill?.Quill;
    if (!Quill || typeof Quill.import !== 'function') return;
    const Clipboard = Quill.import('modules/clipboard');
    if (!Clipboard) return;

    class PreserveCodeIndentClipboard extends Clipboard {
      prepareMatching(container, nodeMatches) {
        const [elementMatchers, textMatchers] = super.prepareMatching(container, nodeMatches);
        const preserveMatcher = (node, delta) => {
          if (!shouldPreserveCodeWhitespace(node)) {
            return delta;
          }

          const rawText = typeof node.data === 'string' ? node.data : '';
          if (!rawText) {
            return delta;
          }

          node.data = '';
          const normalized = rawText.replace(/\r\n/g, '\n');
          return delta.insert(normalized);
        };

        textMatchers.unshift(preserveMatcher);
        return [elementMatchers, textMatchers];
      }
    }

    Quill.register('modules/clipboard', PreserveCodeIndentClipboard, true);
    patched = true;
  };
})();

if (typeof window !== 'undefined') {
  window.katex = katex;
  ensureClipboardPreservesCodeIndent();
}

export const useQuillModules = () =>
  useMemo(() => {
    try {
      initializeQuillHandlers();
      registerQuillFormats();

      const tableHandler = async function () {
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
            const cursor = Math.max(
              Math.min(range.index - (direction === 'backward' ? 1 : 0), quillInstance.getLength() - 1),
              0,
            );
            quillInstance.setSelection(
              cursor,
              0,
              QuillConstructor.sources?.SILENT ?? 'silent',
            );
            const char = quillInstance.getText(cursor, 1);
            if (char === '\n') {
              quillInstance.deleteText(cursor, 1, 'user');
              quillInstance.setSelection(
                Math.max(cursor - 1, 0),
                0,
                QuillConstructor.sources?.SILENT ?? 'silent',
              );
            }
            return true;
          };

          if (range.length > 0 && tableModule) {
            const delta = quillInstance.getContents(range.index, range.length);
            const hasTable = delta.ops?.some((op) => {
              const attrs = op?.attributes || {};
              return Object.keys(attrs).some((key) => key.startsWith('table'));
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
                  quillInstance.setSelection(
                    cellIndex,
                    0,
                    QuillConstructor.sources?.SILENT ?? 'silent',
                  );
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
            [{ header: [1, 2, 3, 4, 5, 6, false] }],
            [
              {
                font: [
                  'Arial',
                  'Times New Roman',
                  'Courier New',
                  'Georgia',
                  'Verdana',
                  '맑은 고딕',
                  '나눔고딕',
                  '나눔바른고딕',
                ],
              },
            ],
            [
              {
                size: [
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
                ],
              },
            ],
            ['bold', 'italic', 'underline', 'strike'],
            [{ script: 'sub' }, { script: 'super' }],
            ['blockquote', 'code-block'],
            [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
            [{ align: ['', 'center', 'right', 'justify'] }],
            ['link', 'image', 'video', 'formula', 'table'],
            ['clean'],
          ],
          handlers: {
            formula() {
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
            table: tableHandler,
          },
        },
        table: true,
        clipboard: {
          matchVisual: false,
        },
        keyboard: {
          bindings: {
            tab: {
              key: 9,
              handler() {
                return true;
              },
            },
            'ctrl+b': {
              key: 66,
              ctrlKey: true,
              handler(range) {
                this.quill.format('bold', !this.quill.getFormat(range).bold);
              },
            },
            'ctrl+i': {
              key: 73,
              ctrlKey: true,
              handler(range) {
                this.quill.format('italic', !this.quill.getFormat(range).italic);
              },
            },
            'ctrl+u': {
              key: 85,
              ctrlKey: true,
              handler(range) {
                this.quill.format('underline', !this.quill.getFormat(range).underline);
              },
            },
            deleteTableBackward: {
              key: 'backspace',
              handler(range) {
                return handleTableDeletion(this.quill, range, 'backward');
              },
            },
            deleteTableForward: {
              key: 'delete',
              handler(range) {
                return handleTableDeletion(this.quill, range, 'forward');
              },
            },
            tableEnter: {
              key: 13,
              handler(range) {
                const quillInstance = this.quill;
                if (!quillInstance || !range) {
                  return true;
                }

                const currentFormat = quillInstance.getFormat(range.index, range.length);
                const previousFormat =
                  range.index > 0 ? quillInstance.getFormat(range.index - 1, 1) : null;
                const relevantKeys = ['table', 'table-cell-line', 'table-header-cell', 'table-body-cell'];
                const hasTableContext = relevantKeys.some(
                  (key) => currentFormat?.[key] || previousFormat?.[key],
                );

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
                quillInstance.setSelection(
                  range.index + 1,
                  0,
                  ReactQuill?.Quill?.sources?.SILENT ?? 'silent',
                );
                return false;
              },
            },
          },
        },
        history: {
          delay: 1000,
          maxStack: 500,
          userOnly: true,
        },
      };
    } catch (error) {
      console.error('Quill 모듈 설정 중 오류 발생:', error);
      return {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
      };
    }
  }, []);

export const quillFormats = [
  'header',
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'strike',
  'script',
  'blockquote',
  'code-block',
  'list',
  'indent',
  'direction',
  'align',
  'link',
  'image',
  'video',
  'formula',
  'table',
];

export const useQuillToolbar = () => {
  useEffect(() => {
    try {
      initializeQuillHandlers();
    } catch (error) {
      console.warn('Quill 핸들러 초기화 중 오류:', error);
    }
  }, []);

  const modules = useQuillModules();

  return {
    modules,
    formats: quillFormats,
    handleImageUpload,
  };
};
