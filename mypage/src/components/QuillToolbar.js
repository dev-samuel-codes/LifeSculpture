// src/components/QuillToolbar.js
import { useMemo, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';

// 이미지 업로드 함수 (Hook이 아닌 일반 함수)
export const handleImageUpload = async (file) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    alert('로그인이 필요합니다. 관리자 계정으로 로그인 후 다시 시도하세요.');
    return null;
  }
  if (!file) return null;

  const MAX_MB = 15;
  if (!file.type?.startsWith('image/')) {
    alert('이미지 파일만 업로드할 수 있어요.');
    return null;
  }
  if (file.size > MAX_MB * 1024 * 1024) {
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

    // 경로는 공개 읽기 정책에 맞춰 post-images 아래로 정리
    const path = `post-images/${Date.now()}-${file.name}`;
    const imgRef = storageRef(storage, path);
    const metadata = { contentType: file.type };

    const snap = await uploadBytes(imgRef, file, metadata);
    console.log('[UPLOAD] done:', {
      fullPath: snap.metadata.fullPath,
      contentType: snap.metadata.contentType,
      size: snap.metadata.size,
    });

    const url = await getDownloadURL(snap.ref);
    console.log('[URL] generated:', url);
    return url;
  } catch (err) {
    console.error('[UPLOAD] failed:', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    if (err?.code === 'storage/unauthorized' || err?.code === 'permission-denied') {
      alert('이미지 업로드 권한이 없습니다. 관리자 계정인지 확인하세요.');
    } else {
      alert('이미지 업로드에 실패했어요. 콘솔의 [UPLOAD] failed 로그를 캡처해서 알려주세요!');
    }
    return null;
  }
};

// Quill 이미지 핸들러
export const useImageHandler = (handleImageUpload) => {
  return useCallback(() => {
    console.log('[imageHandler] called');
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      console.log('[imageHandler] onchange');
      const file = input.files && input.files[0];
      if (!file) {
        console.log('[imageHandler] no file selected');
        return;
      }

      try {
        console.log('[imageHandler] uploading file:', file.name);
        const url = await handleImageUpload(file);
        console.log('[imageHandler] upload result url:', url);
        if (!url) return;

        // 에디터 참조는 외부에서 전달받아야 함
        return url;
      } catch (err) {
        console.error('[HANDLER] failed:', err);
        alert('이미지 삽입에 실패했어요.');
        return null;
      }
    };
  }, [handleImageUpload]);
};

// 테이블 삽입 핸들러
export const useTableHandler = () => {
  return useCallback(() => {
    // 에디터 참조는 외부에서 전달받아야 함
    return true;
  }, []);
};

// Quill 모듈 설정
export const useQuillModules = (imageHandler, tableHandler) => {
  return useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ script: 'sub' }, { script: 'super' }],
          ['blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
          [{ direction: 'rtl' }, { align: [] }],
          ['link', 'image', 'video'],
          ['clean'],
        ],
        handlers: { image: imageHandler, table: tableHandler },
      },
      clipboard: { matchVisual: false },
      table: true,
      keyboard: {
        bindings: {
          tab: {
            key: 9,
            handler: function() {
              return true;
            }
          }
        }
      },
    }),
    [imageHandler, tableHandler]
  );
};

// Quill 포맷 설정
export const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'script',
  'blockquote', 'code-block',
  'list', 'bullet', 'indent',
  'direction', 'align',
  'link', 'image', 'video',
  'table', 'tableHeader', 'tableCell',
];

// 툴바 설정을 위한 커스텀 훅
export const useQuillToolbar = () => {
  const imageHandler = useImageHandler(handleImageUpload);
  const tableHandler = useTableHandler();
  const modules = useQuillModules(imageHandler, tableHandler);

  return {
    modules,
    formats: quillFormats,
    handleImageUpload,
    imageHandler,
    tableHandler,
  };
};
