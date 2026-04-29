// content utils: 편집기 콘텐츠 크기 계산 및 정리 유틸리티
export const calculateContentSize = (htmlContent) => {
  const textContent = String(htmlContent || '').replace(/<[^>]*>/g, '');
  return new Blob([textContent]).size;
};

export const sanitizeHtml = (html) => {
  if (!html) return '';

  // 1. Remove script tags
  let sanitized = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, '');

  // 2. Remove event handlers (e.g., onerror, onload)
  sanitized = sanitized.replace(/on\w+="[^"]*"/g, '');
  sanitized = sanitized.replace(/on\w+='[^']*'/g, '');
  sanitized = sanitized.replace(/on\w+=`[^`]*`/g, '');
  sanitized = sanitized.replace(/on\w+=\w+/g, '');


  // 3. Remove javascript: URLs
  sanitized = sanitized.replace(/href="javascript:[^"]*"/g, 'href="#"');
  sanitized = sanitized.replace(/src="javascript:[^"]*"/g, 'src="#"');


  // 4. Collapse multiple empty paragraphs into a single one
  sanitized = sanitized.replace(/(<p><br><\/p>\s*){2,}/g, '<p><br></p>');

  // 5. Trim whitespace at the beginning and end
  sanitized = sanitized.trim();

  return sanitized;
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
