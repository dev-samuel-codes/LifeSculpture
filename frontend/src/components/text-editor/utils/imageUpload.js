// imageUpload utils: 에디터 이미지 업로드와 Storage 연동 로직
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase/firebase';

// 이미지 압축 함수 - KB 단위로 압축
const compressImage = (file) =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      const MAX_WIDTH = 2560;
      const MAX_HEIGHT = 2560;
      const targetSizeKB = 350;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (blob.size <= targetSizeKB * 1024 || quality <= 0.05) {
              resolve(blob);
            } else {
              quality -= 0.15;
              if (quality < 0.05) quality = 0.05;
              tryCompress();
            }
          },
          'image/jpeg',
          quality,
        );
      };

      tryCompress();
    };

    img.src = URL.createObjectURL(file);
  });

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

  const MAX_MB = 15;
  if (!file.type?.startsWith('image/')) {
    console.error('[handleImageUpload] invalid file type:', file.type);
    alert('이미지 파일만 업로드할 수 있어요.');
    return null;
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    console.error('[handleImageUpload] file too large:', file.size);
    alert(`이미지 용량이 큽니다. 최대 ${MAX_MB}MB까지 업로드할 수 있어요.`);
    return null;
  }

  try {
    let processedFile = file;
    const originalSizeMB = file.size / (1024 * 1024);

    if (originalSizeMB >= 1) {
      processedFile = await compressImage(file);
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `post-images/${user.uid}/${Date.now()}-${sanitizedName}`;

    const imgRef = storageRef(storage, path);

    const metadata = { contentType: processedFile.type || 'image/jpeg' };
    const snap = await uploadBytes(imgRef, processedFile, metadata);
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
