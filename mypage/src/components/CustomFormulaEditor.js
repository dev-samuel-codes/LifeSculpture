// src/components/CustomFormulaEditor.js
import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import '../style/CustomFormulaEditor.css';

const CustomFormulaEditor = ({ isOpen, onClose, onSave, initialValue = '' }) => {
  const [latex, setLatex] = useState(initialValue);
  const previewRef = useRef(null);
  const textareaRef = useRef(null);

  // LaTeX 기호 목록
  const symbols = [
    { name: '분수', latex: '\frac{ { } }{ { } }' },
    { name: '제곱', latex: '^{ }' },
    { name: '아래첨자', latex: '_{ }' },
    { name: '제곱근', latex: '\sqrt{ }' },
    { name: 'n제곱근', latex: '\sqrt[n]{ }' },
    { name: '합계', latex: '\sum_{k=1}^{n}' },
    { name: '곱', latex: '\prod_{k=1}^{n}' },
    { name: '적분', latex: '\int_{a}^{b}' },
    { name: '극한', latex: '\lim_{x\to\infty}' },
    { name: '행렬', latex: '\begin{pmatrix} a & b \\ c & d \end{pmatrix}' },
    { name: '알파', latex: '\alpha' },
    { name: '베타', latex: '\beta' },
    { name: '감마', latex: '\gamma' },
    { name: '파이', latex: '\pi' },
  ];

  // 기호 클릭 시 텍스트 에어리어에 삽입
  const insertSymbol = (symbolLatex) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newLatex = latex.substring(0, start) + symbolLatex + latex.substring(end);
    
    setLatex(newLatex);
    textarea.focus();

    // 괄호 안에 커서 위치시키기
    setTimeout(() => {
      const bracketPos = newLatex.indexOf('{', start);
      if (bracketPos !== -1) {
        textarea.setSelectionRange(bracketPos + 1, bracketPos + 1);
      } else {
        textarea.setSelectionRange(start + symbolLatex.length, start + symbolLatex.length);
      }
    }, 0);
  };

  // 실시간 미리보기 업데이트
  useEffect(() => {
    if (previewRef.current) {
      try {
        katex.render(latex, previewRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (error) {
        previewRef.current.innerText = error.message;
      }
    }
  }, [latex]);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setLatex(initialValue || '');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialValue]);

  const handleSave = () => {
    if (latex.trim()) {
      onSave(latex);
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="formula-editor-overlay">
      <div className="formula-editor-modal">
        <div className="formula-editor-header">
          <h3>수식 편집기</h3>
          <button onClick={onClose} className="close-button">&times;</button>
        </div>
        <div className="formula-editor-body">
          <div className="input-area">
            <textarea
              ref={textareaRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="여기에 LaTeX 코드를 입력하세요..."
            />
            <div className="symbol-palette">
              {symbols.map(symbol => (
                <button key={symbol.name} onClick={() => insertSymbol(symbol.latex)}>
                  {symbol.name}
                </button>
              ))}
            </div>
          </div>
          <div className="preview-area">
            <h4>미리보기</h4>
            <div ref={previewRef} className="preview-content" />
          </div>
        </div>
        <div className="formula-editor-footer">
          <button onClick={onClose} className="btn-cancel">취소</button>
          <button onClick={handleSave} className="btn-save">저장</button>
        </div>
      </div>
    </div>
  );
};

export default CustomFormulaEditor;
