export const calculateContentSize = (htmlContent) => {
  const textContent = String(htmlContent || '').replace(/<[^>]*>/g, '');
  return new Blob([textContent]).size;
};

export const sanitizeContent = (html) =>
  String(html || '').trim().replace(/<p><br><\/p>/g, '');
