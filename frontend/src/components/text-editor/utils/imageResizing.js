import { applyStoredImageSizing } from './imageSizing';

const OUTLINE_CLASS = 'ql-image-resize-outline';
const HANDLE_CLASS = 'ql-image-resize-handle';
const SIZE_LABEL_CLASS = 'ql-image-resize-size';
const MIN_IMAGE_WIDTH = 80;
const KEYBOARD_RESIZE_STEP = 10;
const LARGE_KEYBOARD_RESIZE_STEP = 50;

const findImageFromTarget = (root, target) => {
  if (!(target instanceof Element)) return null;
  const image = target.closest('img');
  return image && root.contains(image) ? image : null;
};

const getMaximumImageWidth = (root, image) => {
  const rootWidth = root.clientWidth || root.getBoundingClientRect().width;
  const parentWidth = image.parentElement?.clientWidth || rootWidth;
  return Math.max(Math.min(rootWidth, parentWidth), MIN_IMAGE_WIDTH);
};

const applyImageWidth = (image, width, maxWidth) => {
  if (!image || !Number.isFinite(width)) return null;

  const nextWidth = Math.round(
    Math.min(Math.max(width, Math.min(MIN_IMAGE_WIDTH, maxWidth)), maxWidth),
  );
  image.setAttribute('width', String(nextWidth));
  image.removeAttribute('height');
  applyStoredImageSizing(image);
  return nextWidth;
};

export const setupImageResizing = ({ root, editor, onResize } = {}) => {
  if (typeof window === 'undefined' || !root) {
    return () => {};
  }

  const container = root.parentElement || root;
  const outline = document.createElement('div');
  outline.className = OUTLINE_CLASS;
  outline.hidden = true;
  outline.setAttribute('aria-hidden', 'true');

  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = HANDLE_CLASS;
  handle.hidden = true;
  handle.setAttribute('aria-label', '이미지 크기 조절');
  handle.setAttribute('title', '드래그하거나 좌우 방향키로 이미지 크기 조절');

  const sizeLabel = document.createElement('output');
  sizeLabel.className = SIZE_LABEL_CLASS;
  sizeLabel.hidden = true;
  sizeLabel.setAttribute('aria-live', 'polite');

  container.append(outline, handle, sizeLabel);

  let activeImage = null;
  let resizeState = null;
  let rafId = null;

  const hideControls = () => {
    if (resizeState) return;
    activeImage = null;
    outline.hidden = true;
    handle.hidden = true;
    sizeLabel.hidden = true;
  };

  const positionControls = () => {
    if (!activeImage || !root.contains(activeImage)) {
      hideControls();
      return;
    }

    const imageRect = activeImage.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const left = imageRect.left - containerRect.left + container.scrollLeft;
    const top = imageRect.top - containerRect.top + container.scrollTop;

    outline.hidden = false;
    outline.style.left = `${left}px`;
    outline.style.top = `${top}px`;
    outline.style.width = `${imageRect.width}px`;
    outline.style.height = `${imageRect.height}px`;

    handle.hidden = false;
    handle.style.left = `${left + imageRect.width - 9}px`;
    handle.style.top = `${top + imageRect.height - 9}px`;

    sizeLabel.hidden = false;
    sizeLabel.value = `${Math.round(imageRect.width)} px`;
    sizeLabel.textContent = `${Math.round(imageRect.width)} px`;
    sizeLabel.style.left = `${left + 6}px`;
    sizeLabel.style.top = `${top + 6}px`;
    handle.setAttribute(
      'aria-label',
      `이미지 크기 조절, 현재 너비 ${Math.round(imageRect.width)}픽셀`,
    );
  };

  const schedulePosition = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      positionControls();
    });
  };

  const showControls = (image) => {
    if (!image) {
      hideControls();
      return;
    }

    activeImage = image;
    schedulePosition();
  };

  const syncContent = () => {
    if (!activeImage) return;
    editor?.update?.('user');
    applyStoredImageSizing(activeImage);
    onResize?.(root.innerHTML);
    schedulePosition();
  };

  const resizeActiveImage = (width) => {
    if (!activeImage) return null;
    const nextWidth = applyImageWidth(
      activeImage,
      width,
      getMaximumImageWidth(root, activeImage),
    );
    schedulePosition();
    return nextWidth;
  };

  const handleRootPointerDown = (event) => {
    const image = findImageFromTarget(root, event.target);
    if (image) {
      showControls(image);
      return;
    }

    if (event.target !== handle) {
      hideControls();
    }
  };

  const handleDocumentPointerDown = (event) => {
    if (root.contains(event.target) || handle.contains(event.target)) return;
    hideControls();
  };

  const handleResizePointerDown = (event) => {
    if (!activeImage || (event.pointerType === 'mouse' && event.button !== 0)) return;

    event.preventDefault();
    event.stopPropagation();

    const imageRect = activeImage.getBoundingClientRect();
    handle.dataset.pointerId = String(event.pointerId);
    handle.setPointerCapture?.(event.pointerId);
    resizeState = {
      startX: event.clientX,
      startWidth: imageRect.width,
      lastWidth: imageRect.width,
    };
  };

  const handleResizePointerMove = (event) => {
    if (!resizeState) return;
    event.preventDefault();
    resizeState.lastWidth =
      resizeActiveImage(resizeState.startWidth + event.clientX - resizeState.startX) ||
      resizeState.lastWidth;
  };

  const finishResize = () => {
    if (!resizeState) return;

    resizeActiveImage(resizeState.lastWidth);
    resizeState = null;
    const pointerId = Number(handle.dataset.pointerId);
    if (Number.isInteger(pointerId)) {
      handle.releasePointerCapture?.(pointerId);
    }
    delete handle.dataset.pointerId;
    syncContent();
  };

  const handleResizeKeyDown = (event) => {
    if (!activeImage || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const step = event.shiftKey ? LARGE_KEYBOARD_RESIZE_STEP : KEYBOARD_RESIZE_STEP;
    const currentWidth = activeImage.getBoundingClientRect().width;
    resizeActiveImage(currentWidth + direction * step);
    syncContent();
  };

  root.addEventListener('pointerdown', handleRootPointerDown, true);
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
  handle.addEventListener('pointerdown', handleResizePointerDown);
  handle.addEventListener('pointermove', handleResizePointerMove);
  handle.addEventListener('pointerup', finishResize);
  handle.addEventListener('pointercancel', finishResize);
  handle.addEventListener('keydown', handleResizeKeyDown);
  document.addEventListener('pointermove', handleResizePointerMove);
  document.addEventListener('pointerup', finishResize);
  document.addEventListener('pointercancel', finishResize);
  window.addEventListener('resize', schedulePosition);
  root.addEventListener('scroll', schedulePosition);

  const mutationObserver = new MutationObserver(schedulePosition);
  mutationObserver.observe(root, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  return () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    root.removeEventListener('pointerdown', handleRootPointerDown, true);
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    handle.removeEventListener('pointerdown', handleResizePointerDown);
    handle.removeEventListener('pointermove', handleResizePointerMove);
    handle.removeEventListener('pointerup', finishResize);
    handle.removeEventListener('pointercancel', finishResize);
    handle.removeEventListener('keydown', handleResizeKeyDown);
    document.removeEventListener('pointermove', handleResizePointerMove);
    document.removeEventListener('pointerup', finishResize);
    document.removeEventListener('pointercancel', finishResize);
    window.removeEventListener('resize', schedulePosition);
    root.removeEventListener('scroll', schedulePosition);
    mutationObserver.disconnect();
    outline.remove();
    handle.remove();
    sizeLabel.remove();
  };
};
