// imageUpload utils: 에디터 이미지 업로드와 Storage 연동 로직
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase/firebase';
import { convertHeicToJpeg } from './media';

const MAX_UPLOAD_MB = 15;
const TARGET_SIZE_KB = 100;
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 2560;
const WEBP_QUALITY_START = 0.82;
const WEBP_QUALITY_MIN = 0.5;
const WEBP_QUALITY_STEP = 0.07;
const SCALE_STEP = 0.85;
const MIN_DIMENSION = 320;
const MAX_ENCODE_ATTEMPTS = 12;

const isGifFile = (file) =>
  file?.type === 'image/gif' || /\.gif$/i.test(file?.name || '');
const isSvgFile = (file) =>
  file?.type === 'image/svg+xml' || /\.svg$/i.test(file?.name || '');
const isHeicFile = (file) =>
  /image\/(heic|heif)/i.test(file?.type || '') || /\.(heic|heif)$/i.test(file?.name || '');
const isJpegFile = (file) =>
  /image\/jpe?g/i.test(file?.type || '') || /\.(jpe?g)$/i.test(file?.name || '');
const isPngFile = (file) =>
  /image\/png/i.test(file?.type || '') || /\.png$/i.test(file?.name || '');
const isWebpFile = (file) =>
  /image\/webp/i.test(file?.type || '') || /\.webp$/i.test(file?.name || '');

const sanitizeFileName = (name) => (name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
const replaceFileExtension = (name, extension) => {
  const sanitized = sanitizeFileName(name);
  const base = sanitized.replace(/\.[^/.]+$/, '');
  return `${base}.${extension}`;
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
  ctx.drawImage(image, 0, 0, width, height);

  return canvasToBlob(canvas, type, quality);
};

const compressImageToTarget = async ({ file, targetBytes, outputType }) => {
  const image = await loadImageElement(file);
  let { naturalWidth: width, naturalHeight: height } = image;

  const ratio = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));

  let quality = WEBP_QUALITY_START;
  let scale = 1;
  let lastBlob = null;

  for (let attempt = 0; attempt < MAX_ENCODE_ATTEMPTS; attempt += 1) {
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const blob = await encodeImage({
      image,
      width: targetWidth,
      height: targetHeight,
      type: outputType,
      quality,
    });

    if (!blob) {
      break;
    }

    lastBlob = blob;
    if (blob.size <= targetBytes) {
      return blob;
    }

    if (quality > WEBP_QUALITY_MIN) {
      quality = Math.max(WEBP_QUALITY_MIN, quality - WEBP_QUALITY_STEP);
      continue;
    }

    const nextWidth = Math.round(targetWidth * SCALE_STEP);
    const nextHeight = Math.round(targetHeight * SCALE_STEP);
    if (nextWidth < MIN_DIMENSION || nextHeight < MIN_DIMENSION) {
      break;
    }
    scale *= SCALE_STEP;
    quality = WEBP_QUALITY_START;
  }

  return lastBlob;
};

export const handleImageUpload = async (file) => {
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

  if (!file.type?.startsWith('image/') && !isHeicFile(file)) {
    console.error('[handleImageUpload] invalid file type:', file.type);
    alert('이미지 파일만 업로드할 수 있어요.');
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

    const isConvertible = !isGifFile(normalizedFile) && !isSvgFile(normalizedFile);
    const shouldConvertToWebp =
      isJpegFile(normalizedFile) ||
      isHeicFile(normalizedFile) ||
      isWebpFile(normalizedFile) ||
      (isPngFile(normalizedFile) && normalizedFile.size > targetBytes);

    let processedBlob = null;
    let outputType = normalizedFile.type || 'image/jpeg';

    if (isConvertible && (normalizedFile.size > targetBytes || shouldConvertToWebp)) {
      outputType = shouldConvertToWebp ? 'image/webp' : outputType;
      processedBlob = await compressImageToTarget({
        file: normalizedFile,
        targetBytes,
        outputType,
      });
    }

    const finalBlob = processedBlob || normalizedFile;
    const finalType = finalBlob.type || outputType || normalizedFile.type || 'image/jpeg';

    if (finalBlob.size > targetBytes && isConvertible) {
      alert('이미지를 100KB 이하로 압축하지 못했습니다. 더 작은 이미지를 사용해주세요.');
      return null;
    }

    const extension = finalType === 'image/webp'
      ? 'webp'
      : finalType === 'image/png'
        ? 'png'
        : finalType === 'image/gif'
          ? 'gif'
          : finalType === 'image/svg+xml'
            ? 'svg'
            : 'jpg';
    const finalName = replaceFileExtension(normalizedFile.name, extension);
    const path = `post-images/${user.uid}/${Date.now()}-${finalName}`;

    const imgRef = storageRef(storage, path);

    const metadata = { contentType: finalType };
    const snap = await uploadBytes(imgRef, finalBlob, metadata);
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
