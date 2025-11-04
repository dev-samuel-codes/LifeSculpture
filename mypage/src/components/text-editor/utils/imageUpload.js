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
            const currentSizeKB = blob.size / 1024;
            console.log(
              `[COMPRESS] 시도: ${currentSizeKB.toFixed(1)}KB (품질: ${quality.toFixed(1)})`,
            );

            if (blob.size <= targetSizeKB * 1024 || quality <= 0.05) {
              console.log(
                `[COMPRESS] 완료: ${currentSizeKB.toFixed(1)}KB (목표: ${targetSizeKB}KB)`,
              );
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
  console.log('[handleImageUpload] start with file:', file);

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
    console.log('[UPLOAD] start:', {
      name: file.name,
      size: file.size,
      type: file.type,
      bucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
      uid: user.uid,
    });

    let processedFile = file;
    const originalSizeKB = file.size / 1024;
    const originalSizeMB = file.size / (1024 * 1024);

    if (originalSizeMB >= 1) {
      console.log(`[COMPRESS] 1MB 이상 감지: ${originalSizeMB.toFixed(1)}MB, 압축 시작`);
      console.log('[COMPRESS] compressing image...');
      processedFile = await compressImage(file);
      const compressedSizeKB = processedFile.size / 1024;
      console.log(
        `[COMPRESS] 압축 완료: ${compressedSizeKB.toFixed(1)}KB (압축률: ${(
          (1 - processedFile.size / file.size) *
          100
        ).toFixed(1)}%)`,
      );
    } else {
      console.log(`[COMPRESS] 1MB 미만: ${originalSizeKB.toFixed(1)}KB, 압축 생략`);
    }

    const path = `post-images/${Date.now()}-${file.name}`;
    console.log('[STORAGE] 업로드 경로:', path);
    console.log('[STORAGE] Storage 참조 생성 중...');

    const imgRef = storageRef(storage, path);
    console.log('[STORAGE] Storage 참조 생성 완료:', imgRef);

    const metadata = { contentType: processedFile.type || 'image/jpeg' };
    console.log('[STORAGE] 메타데이터:', metadata);

    console.log('[STORAGE] 이미지 업로드 시작...');
    const snap = await uploadBytes(imgRef, processedFile, metadata);
    console.log('[STORAGE] 업로드 완료:', {
      fullPath: snap.metadata.fullPath,
      contentType: snap.metadata.contentType,
      size: snap.metadata.size,
      bucket: snap.metadata.bucket,
    });

    console.log('[STORAGE] 다운로드 URL 생성 중...');
    const url = await getDownloadURL(snap.ref);
    console.log('[STORAGE] 다운로드 URL 생성 완료:', url);

    if (!url) {
      console.error('[STORAGE] 다운로드 URL이 생성되지 않음');
      throw new Error('다운로드 URL 생성 실패');
    }

    console.log('[UPLOAD] 전체 과정 완료. 반환할 URL:', url);
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

