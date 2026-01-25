// media utils: 이미지 변환과 경로 분석, 비교 기능 제공
import heic2any from 'heic2any';

export const convertHeicToJpeg = async (file) => {
  if (!file) return file;
  if (/image\/(heic|heif)/.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.8,
    });
    const normalizedBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    const blob = normalizedBlob instanceof Blob
      ? normalizedBlob
      : new Blob([normalizedBlob], { type: 'image/jpeg' });
    return new File(
      [blob],
      file.name.replace(/\.(heic|heif)$/i, '.jpg'),
      { type: 'image/jpeg' },
    );
  }
  return file;
};

export const extractImageUrls = (content, { filter } = {}) => {
  if (!content) return [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  const urls = [];
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    const url = match[1];
    if (typeof filter === 'function' && !filter(url)) continue;
    urls.push(url);
  }

  return urls;
};

export const extractStoragePath = (imageUrl) => {
  if (!imageUrl || !imageUrl.startsWith('https://firebasestorage.googleapis.com')) {
    return null;
  }

  try {
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const oIndex = pathParts.findIndex((part) => part === 'o');
    if (oIndex !== -1 && oIndex + 1 < pathParts.length) {
      const encoded = pathParts.slice(oIndex + 1).join('/');
      const sanitized = encoded.replace(/%252F/g, '/');
      const decoded = decodeURIComponent(sanitized);
      return decoded && !decoded.includes('?') ? decoded : null;
    }
  } catch (error) {
    const urlParts = imageUrl.split('/');
    const pathIndex = urlParts.findIndex((part) => part === 'o');
    if (pathIndex !== -1 && pathIndex + 1 < urlParts.length) {
      let encodedPath = urlParts[pathIndex + 1];
      if (encodedPath.includes('?')) {
        encodedPath = encodedPath.split('?')[0];
      }
      encodedPath = encodedPath.replace(/&amp;/g, '&').replace(/%252F/g, '/');
      const decoded = decodeURIComponent(encodedPath);
      return decoded && !decoded.includes('?') ? decoded : null;
    }
  }

  return null;
};

export const isSameStorageImage = (urlA, urlB) => {
  if (!urlA || !urlB) return false;
  if (
    urlA.startsWith('https://firebasestorage.googleapis.com') &&
    urlB.startsWith('https://firebasestorage.googleapis.com')
  ) {
    return extractStoragePath(urlA) === extractStoragePath(urlB);
  }
  return urlA === urlB;
};
