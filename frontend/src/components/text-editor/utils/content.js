// content utils: 편집기 콘텐츠 크기 계산 및 정리 유틸리티
import DOMPurify from 'dompurify';

export const calculateContentSize = (htmlContent) => {
  const textContent = String(htmlContent || '').replace(/<[^>]*>/g, '');
  return new Blob([textContent]).size;
};

const ALLOWED_IFRAME_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
]);

const isAllowedIframeSrc = (src) => {
  if (!src || typeof window === 'undefined') return false;
  try {
    const url = new URL(src, window.location.origin);
    return url.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.has(url.hostname);
  } catch (error) {
    return false;
  }
};

const stripUnsafeEmbeds = (html) => {
  if (!html || typeof DOMParser === 'undefined') return html || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('iframe').forEach((iframe) => {
    if (!isAllowedIframeSrc(iframe.getAttribute('src'))) {
      iframe.remove();
    }
  });
  return doc.body.innerHTML;
};

export const sanitizeHtml = (html) => {
  if (!html) return '';

  const sanitized = DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'img', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'iframe',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class',
      'target', 'rel',
      'colspan', 'rowspan',
      'width', 'height', 'frameborder', 'allow', 'allowfullscreen',
      'data-line-number',
    ],
    FORBID_TAGS: ['script', 'object', 'embed', 'svg', 'math'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'srcdoc', 'style'],
  });

  return stripUnsafeEmbeds(sanitized)
    .replace(/(<p><br><\/p>\s*){2,}/g, '<p><br></p>')
    .trim();
};

export const sanitizeContent = (html) =>
  String(html || '').trim().replace(/<p><br><\/p>/g, '');

export const normalizeTableCellBreaksForEditor = (html) => {
  if (!html || typeof DOMParser === 'undefined') return html || '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('td br, th br').forEach((lineBreak) => {
    lineBreak.replaceWith(doc.createTextNode('\n'));
  });

  return doc.body.innerHTML;
};
