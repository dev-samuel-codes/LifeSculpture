export const getResponsiveEditorHeight = (width) => {
  const viewport =
    typeof width === 'number'
      ? width
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 1024;

  if (viewport <= 480) return '300px';
  if (viewport <= 768) return '350px';
  return '400px';
};
