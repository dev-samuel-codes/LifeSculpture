// mypage/src/components/QuillCustomBlots.js
import ReactQuill from 'react-quill-new';

const BlockEmbed = ReactQuill.Quill.import('blots/block/embed');

class ImageBlot extends BlockEmbed {
  static create(value) {
    const node = super.create();
    node.setAttribute('src', value.src);
    node.setAttribute('alt', value.alt);
    if (value.width) {
      node.setAttribute('width', value.width);
    }
    if (value.style) {
      node.setAttribute('style', value.style);
    }
    return node;
  }

  static value(node) {
    return {
      src: node.getAttribute('src'),
      alt: node.getAttribute('alt'),
      width: node.getAttribute('width'),
      style: node.getAttribute('style'),
    };
  }
}

ImageBlot.blotName = 'image';
ImageBlot.tagName = 'img';

export default ImageBlot;
