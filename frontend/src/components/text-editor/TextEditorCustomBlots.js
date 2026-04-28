// TextEditorCustomBlots: Quill에서 사용하는 커스텀 이미지 블롯 정의
import ReactQuill from 'react-quill-new';

const BlockEmbed = ReactQuill.Quill.import('blots/block/embed');
const Embed = ReactQuill.Quill.import('blots/embed');

class TextEditorImageBlot extends BlockEmbed {
  static create(value) {
    const node = super.create();
    
    // value가 문자열인 경우 (기본 이미지 URL)
    if (typeof value === 'string') {
      node.setAttribute('src', value);
      node.setAttribute('alt', '');
    } else if (value && typeof value === 'object') {
      // value가 객체인 경우 (확장된 속성)
      node.setAttribute('src', value.src || '');
      node.setAttribute('alt', value.alt || '');
      if (value.width) {
        node.setAttribute('width', value.width);
      }
      if (value.height) {
        node.setAttribute('height', value.height);
      }
      if (value.style) {
        node.setAttribute('style', value.style);
      }
    }
    
    return node;
  }

  static value(node) {
    return {
      src: node.getAttribute('src'),
      alt: node.getAttribute('alt'),
      width: node.getAttribute('width'),
      height: node.getAttribute('height'),
      style: node.getAttribute('style'),
    };
  }
}

TextEditorImageBlot.blotName = 'custom-image-blot';
TextEditorImageBlot.tagName = 'img';

class TextEditorLineBreakBlot extends Embed {
  static create() {
    return document.createElement('br');
  }

  static value() {
    return true;
  }
}

TextEditorLineBreakBlot.blotName = 'line-break';
TextEditorLineBreakBlot.tagName = 'br';

let isRegistered = false;

export const registerTextEditorImageBlot = () => {
  if (!isRegistered) {
    try {
      ReactQuill.Quill.register(TextEditorImageBlot);
      ReactQuill.Quill.register(TextEditorLineBreakBlot);
      isRegistered = true;
    } catch (error) {
      console.warn('TextEditorImageBlot 등록 중 오류:', error);
    }
  }
};

export default TextEditorImageBlot;
