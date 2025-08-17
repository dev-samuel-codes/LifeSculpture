// src/components/CustomFormulaEditor.js
import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import '../style/CustomFormulaEditor.css';

// KaTeX 렌더링을 위한 버튼 컴포넌트
const KatexButton = ({ latex, onClick }) => {
  const spanRef = useRef(null);

  useEffect(() => {
    if (spanRef.current) {
      try {
        katex.render(latex, spanRef.current, { throwOnError: false });
      } catch (error) {
        spanRef.current.innerText = 'Error';
      }
    }
  }, [latex]);

  return (
    <button onClick={onClick} title={latex}>
      <span ref={spanRef} />
    </button>
  );
};

const CustomFormulaEditor = ({ isOpen, onClose, onSave, initialValue = '' }) => {
  const [latex, setLatex] = useState(initialValue);
  const previewRef = useRef(null);
  const textareaRef = useRef(null);

  // LaTeX 기호 목록 (백슬래시 이스케이프 수정 및 미리보기용 코드 추가)
  const symbols = [
    { name: '분수', latex: '\\frac{ }{ }', preview: '\\frac{a}{b}' },
    { name: '제곱', latex: '^{ }', preview: 'x^2' },
    { name: '아래첨자', latex: '_{ }', preview: 'x_1' },
    { name: '제곱근', latex: '\\sqrt{ }', preview: '\\sqrt{x}' },
    { name: 'n제곱근', latex: '\\sqrt[n]{ }', preview: '\\sqrt[n]{x}' },
    { name: '합계', latex: '\\sum_{k=1}^{n}', preview: '\\sum' },
    { name: '곱', latex: '\\prod_{k=1}^{n}', preview: '\\prod' },
    // eslint-disable-next-line no-useless-escape
    { name: '적분', latex: '\\int_{a}^{b}', preview: '\\int' },
    // eslint-disable-next-line no-useless-escape
    { name: '극한', latex: '\\lim_{x\to\infty}', preview: '\\lim' },
    { name: '행렬', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', preview: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
    { name: '알파', latex: '\\alpha', preview: '\\alpha' },
    { name: '베타', latex: '\\beta', preview: '\\beta' },
    { name: '감마', latex: '\\gamma', preview: '\\gamma' },
    { name: '파이', latex: '\\pi', preview: '\\pi' },
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
          <div className="symbol-palette">
            {symbols.map(symbol => (
              <KatexButton 
                key={symbol.name} 
                latex={symbol.preview} 
                onClick={() => insertSymbol(symbol.latex)} 
              />
            ))}
          </div>
          <div className="preview-area">
            <div ref={previewRef} className="preview-content" />
          </div>
          <div className="input-area">
            <textarea
              ref={textareaRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="여기에 LaTeX 코드를 입력하세요..."
            />
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