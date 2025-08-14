// mypage/src/components/QuillCustomBlots.js
import ReactQuill from 'react-quill-new';

const BlockEmbed = ReactQuill.Quill.import('blots/block/embed');

class CustomImageBlot extends BlockEmbed {
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

CustomImageBlot.blotName = 'custom-image';
CustomImageBlot.tagName = 'img';

export default CustomImageBlot;
