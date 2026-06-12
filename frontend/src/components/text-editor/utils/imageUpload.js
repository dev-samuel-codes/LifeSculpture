// imageUpload utils: 에디터 이미지 업로드와 Storage 연동 로직
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase/firebase';
import { convertHeicToJpeg } from './media';

const MAX_UPLOAD_MB = 5;
const TARGET_SIZE_KB = 100;
const MAX_DIMENSION = 2560;
const MIN_DIMENSION = 64;
const QUALITY_MAX = 0.88;
const QUALITY_MIN = 0.1;
const QUALITY_SEARCH_STEPS = 7;
const MAX_SCALE_STEPS = 12;
const SHRINK_RATIO_MAX = 0.9;
const SHRINK_RATIO_MIN = 0.2;

const WEBP_SUPPORTED = (() => {
  if (typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch (error) {
    return false;
  }
})();

const isGifFile = (file) =>
  file?.type === 'image/gif' || /\.gif$/i.test(file?.name || '');
const isSvgFile = (file) =>
  file?.type === 'image/svg+xml' || /\.svg$/i.test(file?.name || '');
const isHeicFile = (file) =>
  /image\/(heic|heif)/i.test(file?.type || '') || /\.(heic|heif)$/i.test(file?.name || '');
const hasImageExtension = (name) => /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name || '');
const isImageCandidate = (file) =>
  file?.type?.startsWith('image/') || hasImageExtension(file?.name) || isHeicFile(file);

const sanitizeFileName = (name) => (name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
const sanitizePathSegment = (value, fallback) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  const sanitized = raw
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized || fallback;
};
const replaceFileExtension = (name, extension) => {
  const sanitized = sanitizeFileName(name);
  const base = sanitized.replace(/\.[^/.]+$/, '');
  return `${base}.${extension}`;
};
const getExtensionForType = (type) => {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
};
const buildStoragePath = ({ category, postId, fileName }) => {
  const safeCategory = sanitizePathSegment(category, 'uncategorized');
  const safePostId = sanitizePathSegment(postId, 'draft');
  return `post-images/${safeCategory}/${safePostId}/${Date.now()}-${fileName}`;
};

const loadImageElement = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });

const dataUrlToBlob = (dataUrl) => {
  const [header, data] = dataUrl.split(',');
  const match = header.match(/data:(.*?);base64/);
  const mime = match ? match[1] : 'application/octet-stream';
  const binary = atob(data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      const dataUrl = canvas.toDataURL(type, quality);
      resolve(dataUrlToBlob(dataUrl));
    }, type, quality);
  });

const encodeImage = async ({ image, width, height, type, quality }) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);

  return canvasToBlob(canvas, type, quality);
};

const getShrinkRatio = (currentBytes, targetBytes) => {
  if (!currentBytes || currentBytes <= targetBytes) return 1;
  const ratio = Math.sqrt(targetBytes / currentBytes) * 0.9;
  return Math.min(SHRINK_RATIO_MAX, Math.max(SHRINK_RATIO_MIN, ratio));
};

const findBestQuality = async ({ image, width, height, type, targetBytes }) => {
  let low = QUALITY_MIN;
  let high = QUALITY_MAX;
  let bestBlob = null;

  for (let step = 0; step < QUALITY_SEARCH_STEPS; step += 1) {
    const quality = (low + high) / 2;
    const blob = await encodeImage({ image, width, height, type, quality });
    if (!blob) {
      break;
    }
    if (blob.size <= targetBytes) {
      bestBlob = blob;
      low = quality;
    } else {
      high = quality;
    }
  }

  if (!bestBlob) {
    bestBlob = await encodeImage({
      image,
      width,
      height,
      type,
      quality: QUALITY_MIN,
    });
  }

  return bestBlob;
};

const compressImageToTarget = async ({ file, targetBytes, outputType }) => {
  const image = await loadImageElement(file);
  const { naturalWidth, naturalHeight } = image;
  const maxSide = Math.max(naturalWidth, naturalHeight);
  const initialScale = maxSide > MAX_DIMENSION ? MAX_DIMENSION / maxSide : 1;
  let scale = initialScale;
  let lastBlob = null;

  for (let step = 0; step < MAX_SCALE_STEPS; step += 1) {
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const blob = await findBestQuality({
      image,
      width,
      height,
      type: outputType,
      targetBytes,
    });

    if (!blob) {
      break;
    }

    lastBlob = blob;
    if (blob.size <= targetBytes) {
      return blob;
    }

    if (width <= MIN_DIMENSION && height <= MIN_DIMENSION) {
      break;
    }

    const shrinkRatio = getShrinkRatio(blob.size, targetBytes);
    if (shrinkRatio >= 1) {
      break;
    }
    const nextScale = scale * shrinkRatio;
    scale = Math.max(nextScale, MIN_DIMENSION / maxSide);
  }

  return lastBlob;
};

export const handleImageUpload = async (file, { category, postId } = {}) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error('[handleImageUpload] no user found');
    alert('로그인이 필요합니다. 관리자 계정으로 로그인 후 다시 시도하세요.');
    return null;
  }
  if (!file) {
    console.error('[handleImageUpload] no file provided');
    return null;
  }

  if (!isImageCandidate(file)) {
    console.error('[handleImageUpload] invalid file type:', file.type);
    alert('이미지 파일만 업로드할 수 있어요.');
    return null;
  }
  if (isSvgFile(file)) {
    alert('SVG 이미지는 보안상 업로드할 수 없어요. PNG, JPG, WebP, GIF를 사용해주세요.');
    return null;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    console.error('[handleImageUpload] file too large:', file.size);
    alert(`이미지 용량이 큽니다. 최대 ${MAX_UPLOAD_MB}MB까지 업로드할 수 있어요.`);
    return null;
  }

  try {
    const targetBytes = TARGET_SIZE_KB * 1024;
    let normalizedFile = file;

    if (isHeicFile(file)) {
      normalizedFile = await convertHeicToJpeg(file);
    }

    const isConvertible = !isGifFile(normalizedFile);
    if (!isConvertible) {
      if (normalizedFile.size > targetBytes) {
        alert('GIF 이미지는 100KB 이하만 업로드할 수 있어요.');
        return null;
      }

      const extension = getExtensionForType(normalizedFile.type);
      const finalName = replaceFileExtension(normalizedFile.name, extension);
      const path = buildStoragePath({ category, postId, fileName: finalName });
      const imgRef = storageRef(storage, path);

      const metadata = { contentType: normalizedFile.type || 'image/gif' };
      const snap = await uploadBytes(imgRef, normalizedFile, metadata);
      const url = await getDownloadURL(snap.ref);

      if (!url) {
        console.error('[STORAGE] 다운로드 URL이 생성되지 않음');
        throw new Error('다운로드 URL 생성 실패');
      }

      return url;
    }

    const outputType = WEBP_SUPPORTED ? 'image/webp' : 'image/jpeg';
    const processedBlob = await compressImageToTarget({
      file: normalizedFile,
      targetBytes,
      outputType,
    });

    if (!processedBlob) {
      alert('이미지 변환에 실패했습니다. 다른 이미지를 사용해주세요.');
      return null;
    }

    if (processedBlob.size > targetBytes) {
      alert('이미지를 100KB 이하로 압축하지 못했습니다. 더 작은 이미지를 사용해주세요.');
      return null;
    }

    const finalType = processedBlob.type || outputType;
    const extension = getExtensionForType(finalType);
    const finalName = replaceFileExtension(normalizedFile.name, extension);
    const path = buildStoragePath({ category, postId, fileName: finalName });

    const imgRef = storageRef(storage, path);
    const metadata = { contentType: finalType };
    const snap = await uploadBytes(imgRef, processedBlob, metadata);
    const url = await getDownloadURL(snap.ref);

    if (!url) {
      console.error('[STORAGE] 다운로드 URL이 생성되지 않음');
      throw new Error('다운로드 URL 생성 실패');
    }

    return url;
  } catch (err) {
    console.error('[UPLOAD] 전체 과정 실패:', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });

    if (err?.code === 'storage/unauthorized' || err?.code === 'permission-denied') {
      alert('이미지 업로드 권한이 없습니다. 관리자 계정인지 확인하세요.');
    } else if (err?.code === 'storage/bucket-not-found') {
      alert('Storage 버킷을 찾을 수 없습니다. Firebase 설정을 확인하세요.');
    } else if (err?.code === 'storage/object-not-found') {
      alert('Storage 객체를 찾을 수 없습니다. 업로드가 실패했을 수 있습니다.');
    } else if (err?.code === 'storage/quota-exceeded') {
      alert('Storage 용량이 초과되었습니다.');
    } else if (err?.code === 'storage/unauthenticated') {
      alert('인증되지 않은 사용자입니다. 로그인 후 다시 시도하세요.');
    } else {
      alert(
        `이미지 업로드에 실패했습니다: ${err.message}\n\n콘솔의 [UPLOAD] failed 로그를 확인해주세요.`,
      );
    }
    throw err;
  }
};
