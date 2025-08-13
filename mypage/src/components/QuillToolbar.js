// src/components/QuillToolbar.js
import { useMemo, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';
import 'katex/dist/katex.min.css';

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

// 네이버 블로그 수준의 고급 툴바 설정
export const useQuillModules = (imageHandler, tableHandler) => {
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
        ['link', 'image', 'video', 'table'],
        ['emoji'],
        
        // 5행: 특수 기능
        ['clean', 'undo', 'redo'],
      ],
      handlers: { 
        image: imageHandler, 
        table: tableHandler,
        emoji: () => {
          // 이모지 선택기 구현
          const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💌', '💘', '💝', '💖', '💗', '💙', '💚', '🧡', '💛', '💜', '🖤', '💟', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💔'];
          const emoji = prompt('이모지를 입력하거나 선택하세요:', emojis.slice(0, 20).join(' '));
          if (emoji) {
            const editor = window.quillEditor;
            if (editor) {
              const range = editor.getSelection(true) || { index: editor.getLength() };
              editor.insertText(range.index, emoji, 'user');
              editor.setSelection(range.index + emoji.length, 0);
            }
          }
        }
      },
      clipboard: { 
        matchVisual: false,
        matchers: [
          ['table', (node, delta) => {
            // 테이블 붙여넣기 지원
            return delta;
          }]
        ]
      },
      table: {
        operation: {
          insertRowAbove: true,
          insertRowBelow: true,
          insertColumnLeft: true,
          insertColumnRight: true,
          deleteRow: true,
          deleteColumn: true,
          deleteTable: true,
        }
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
    [imageHandler, tableHandler]
  );
};

// 확장된 Quill 포맷 설정
export const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'script',
  'blockquote', 'code-block',
  'list', 'bullet', 'indent',
  'direction', 'align',
  'link', 'image', 'video',
  'table', 'tableHeader', 'tableCell',
  'emoji',
  'code', 'pre'
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
