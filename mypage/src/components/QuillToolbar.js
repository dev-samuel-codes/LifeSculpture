// src/components/QuillToolbar.js
import { useMemo, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';
import 'katex/dist/katex.min.css';

// 이미지 업로드 함수 (Hook이 아닌 일반 함수)
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

    // 경로는 공개 읽기 정책에 맞춰 post-images 아래로 정리
    const path = `post-images/${Date.now()}-${file.name}`;
    const imgRef = storageRef(storage, path);
    const metadata = { contentType: file.type };

    console.log('[UPLOAD] uploading to path:', path);
    const snap = await uploadBytes(imgRef, file, metadata);
    console.log('[UPLOAD] done:', {
      fullPath: snap.metadata.fullPath,
      contentType: snap.metadata.contentType,
      size: snap.metadata.size,
    });

    console.log('[UPLOAD] getting download URL...');
    const url = await getDownloadURL(snap.ref);
    console.log('[URL] generated:', url);
    
    if (!url) {
      console.error('[handleImageUpload] no URL returned from getDownloadURL');
      return null;
    }
    
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
    throw err;
  }
};

// Quill 이미지 핸들러
export const useImageHandler = () => {
  return useCallback(() => {
    console.log('[imageHandler] called');
    
    // 에디터 참조 가져오기 (여러 방법 시도)
    let editor = null;
    if (window.quillEditor) {
      editor = window.quillEditor;
    } else {
      // DOM에서 직접 찾기
      const quillElement = document.querySelector('.ql-editor');
      if (quillElement && quillElement.__quill) {
        editor = quillElement.__quill;
      }
    }
    
    if (!editor) {
      console.error('[imageHandler] editor not found, trying to find...');
      // 약간의 지연 후 다시 시도
      setTimeout(() => {
        if (window.quillEditor) {
          console.log('[imageHandler] editor found after delay');
        } else {
          alert('에디터가 준비되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
          return;
        }
      }, 500);
      return;
    }

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
        if (!url) {
          console.error('[imageHandler] no URL returned');
          return;
        }

        // 에디터 참조 다시 확인
        let currentEditor = window.quillEditor;
        if (!currentEditor) {
          const quillElement = document.querySelector('.ql-editor');
          if (quillElement && quillElement.__quill) {
            currentEditor = quillElement.__quill;
          }
        }

        if (currentEditor) {
          const range = currentEditor.getSelection(true) || { index: currentEditor.getLength() };
          console.log('[imageHandler] inserting image at index:', range.index);
          
          // 기본 이미지 삽입 방식 사용
          currentEditor.insertEmbed(range.index, 'image', url, 'user');
          currentEditor.setSelection(range.index + 1, 0);
          console.log('[imageHandler] image inserted successfully');
        } else {
          console.error('[imageHandler] editor still not found after upload');
          alert('에디터를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        }
      } catch (err) {
        console.error('[HANDLER] failed:', err);
        alert('이미지 삽입에 실패했어요: ' + err.message);
      }
    };
  }, []);
};

// 테이블 삽입 핸들러 (제거됨 - Quill 기본 테이블 모듈이 없음)
// export const useTableHandler = () => {
//   return useCallback(() => {
//     const editor = window.quillEditor;
//     if (editor) {
//       const range = editor.getSelection(true) || { index: editor.getLength() };
//       editor.insertTable(3, 3, range.index);
//       editor.setSelection(range.index + 1, 0);
//     } else {
//       console.error('[tableHandler] editor not found');
//       alert('에디터가 준비되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
//     }
//   }, []);
// };

// 네이버 블로그 수준의 고급 툴바 설정
export const useQuillModules = (imageHandler) => {
  return useMemo(
    () => ({
      toolbar: [
        // 1행: 제목 스타일, 폰트, 크기
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', '맑은 고딕', '나눔고딕', '나눔바른고딕'] }],
        [{ 'size': ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72'] }],
        
        // 2행: 텍스트 스타일
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'script': 'sub' }, { 'script': 'super' }],
        
        // 3행: 문단 스타일
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        [{ 'direction': 'rtl' }, { 'align': ['', 'left', 'center', 'right', 'justify'] }],
        
        // 4행: 미디어 및 고급 기능
        ['link', 'image', 'video'],
        
        // 5행: 특수 기능
        ['clean'],
      ],
      handlers: { 
        image: imageHandler, 
      },
      clipboard: { 
        matchVisual: false
      },
      keyboard: {
        bindings: {
          tab: {
            key: 9,
            handler: function() {
              return true;
            }
          },
          'ctrl+b': {
            key: 66,
            ctrlKey: true,
            handler: function(range, context) {
              this.quill.format('bold', !this.quill.getFormat(range).bold);
            }
          },
          'ctrl+i': {
            key: 73,
            ctrlKey: true,
            handler: function(range, context) {
              this.quill.format('italic', !this.quill.getFormat(range).italic);
            }
          },
          'ctrl+u': {
            key: 85,
            ctrlKey: true,
            handler: function(range, context) {
              this.quill.format('underline', !this.quill.getFormat(range).underline);
            }
          }
        }
      },
      history: {
        delay: 1000,
        maxStack: 500,
        userOnly: true
      }
    }),
    [imageHandler]
  );
};

// 확장된 Quill 포맷 설정 (지원되는 포맷만 포함)
export const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'script',
  'blockquote', 'code-block',
  'list', 'indent',
  'direction', 'align',
  'link', 'image', 'video'
];

// 툴바 설정을 위한 커스텀 훅
export const useQuillToolbar = () => {
  const imageHandler = useImageHandler();
  const modules = useQuillModules(imageHandler);

  return {
    modules,
    formats: quillFormats,
    handleImageUpload,
    imageHandler,
  };
};
