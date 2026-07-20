export const applyStoredImageSizing = (img) => {
  if (!img) return false;

  const widthAttribute = img.getAttribute('width')?.trim() || '';
  if (!/^\d+$/.test(widthAttribute)) {
    return false;
  }

  const storedWidth = Number.parseInt(widthAttribute, 10);
  if (!Number.isFinite(storedWidth) || storedWidth <= 0) {
    return false;
  }

  img.style.setProperty('width', `${Math.round(storedWidth)}px`, 'important');
  img.style.setProperty('max-width', '100%', 'important');
  img.style.setProperty('height', 'auto', 'important');
  img.style.setProperty('max-height', 'none', 'important');
  return true;
};

export const setupResponsiveImageSizing = ({
  root,
  portraitClassName = 'portrait-image',
  portraitThreshold = 1.05,
} = {}) => {
  if (typeof window === 'undefined' || !root) {
    return () => {};
  }

  const loadHandlers = new Map();

  const classifyImage = (img) => {
    applyStoredImageSizing(img);

    const { naturalWidth, naturalHeight } = img;
    if (!naturalWidth || !naturalHeight) return;

    const aspectRatio = naturalHeight / Math.max(naturalWidth, 1);
    if (aspectRatio > portraitThreshold) {
      img.classList.add(portraitClassName);
    } else {
      img.classList.remove(portraitClassName);
    }
  };

  const observeImage = (img) => {
    if (img.complete && img.naturalWidth) {
      classifyImage(img);
      return;
    }

    const handleLoad = () => classifyImage(img);
    loadHandlers.set(img, handleLoad);
    img.addEventListener('load', handleLoad);
  };

  root.querySelectorAll('img').forEach(observeImage);

  return () => {
    loadHandlers.forEach((handler, img) => {
      img.removeEventListener('load', handler);
    });
    loadHandlers.clear();
  };
};
