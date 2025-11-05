// content utils: 편집기 콘텐츠 크기 계산 및 정리 유틸리티
export const calculateContentSize = (htmlContent) => {
  const textContent = String(htmlContent || '').replace(/<[^>]*>/g, '');
  return new Blob([textContent]).size;
};

export const sanitizeContent = (html) =>
  String(html || '').trim().replace(/<p><br><\/p>/g, '');
