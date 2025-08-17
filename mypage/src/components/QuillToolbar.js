// src/components/QuillToolbar.js
import { useMemo, useCallback, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ReactQuill from 'react-quill-new';

// katex를 전역 객체에 할당
window.katex = katex;

// Quill 핸들러 모듈 초기화 함수
const initializeQuillHandlers = () => {
  try {
    const Quill = ReactQuill?.Quill;
    if (Quill && typeof Quill.register === 'function') {
      // 핸들러 모듈이 존재하지 않으면 빈 모듈로 등록
      if (!Quill.imports || !Quill.imports['modules/handlers']) {
        const HandlersModule = {
          handlers: {},
          addHandler: function(format, handler) {
            this.handlers[format] = handler;
          },
          getHandler: function(format) {
            return this.handlers[format];
          }
        };
        Quill.register('modules/handlers', HandlersModule, true);
        console.log('Quill handlers 모듈 등록 완료');
      }
    } else {
      console.warn('Quill 인스턴스를 찾을 수 없거나 register 메서드가 없습니다.');
    }
  } catch (error) {
    console.warn('Quill handlers 모듈 초기화 중 오류:', error);
  }
};

// 이미지 압축 함수 - KB 단위로 압축
const compressImage = (file) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // 원본 이미지 크기
      let { width, height } = img;
      
      // 원본 파일 크기에 따른 압축 목표 설정
      const originalSizeMB = file.size / (1024 * 1024);
      let targetSizeKB;
      
      if (originalSizeMB > 10) {
        targetSizeKB = 100; // 10MB 이상이면 100KB로 압축
      } else if (originalSizeMB > 5) {
        targetSizeKB = 200; // 5MB 이상이면 200KB로 압축
      } else if (originalSizeMB > 2) {
        targetSizeKB = 300; // 2MB 이상이면 300KB로 압축
      } else if (originalSizeMB > 1) {
        targetSizeKB = 400; // 1MB 이상이면 400KB로 압축 (더 강력하게)
      } else {
        targetSizeKB = 600; // 1MB 미만이면 600KB로 압축
      }
      
      console.log(`[COMPRESS] 원본: ${originalSizeMB.toFixed(1)}MB, 목표: ${targetSizeKB}KB`);
      
      // 더 강력한 리사이즈 적용
      let maxDimension = 1920;
      if (originalSizeMB > 5) {
        maxDimension = 1280; // 5MB 이상이면 더 작게
      } else if (originalSizeMB > 2) {
        maxDimension = 1600; // 2MB 이상이면 중간 크기
      }
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
        console.log(`[COMPRESS] 리사이즈: ${width}x${height}`);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height);
      
      // 더 강력한 압축을 위한 품질 조정
      let quality = 0.8; // 시작 품질을 낮춤
      
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          const currentSizeKB = blob.size / 1024;
          console.log(`[COMPRESS] 시도: ${currentSizeKB.toFixed(1)}KB (품질: ${quality.toFixed(1)})`);
          
          if (blob.size <= targetSizeKB * 1024 || quality <= 0.05) {
            // 압축된 이미지가 목표 크기 이하이거나 최소 품질에 도달
            console.log(`[COMPRESS] 완료: ${currentSizeKB.toFixed(1)}KB (목표: ${targetSizeKB}KB)`);
            resolve(blob);
          } else {
            // 품질을 더 빠르게 낮춤
            quality -= 0.15;
            if (quality < 0.05) quality = 0.05;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };
      
      tryCompress();
    };
    
    img.src = URL.createObjectURL(file);
  });
};

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

    // 이미지 압축 - 1MB 이상인 경우에만 적용
    let processedFile = file;
    const originalSizeKB = file.size / 1024;
    const originalSizeMB = file.size / (1024 * 1024);
    
    if (originalSizeMB >= 1) {
      console.log(`[COMPRESS] 1MB 이상 감지: ${originalSizeMB.toFixed(1)}MB, 압축 시작`);
      console.log('[COMPRESS] compressing image...');
      processedFile = await compressImage(file);
      const compressedSizeKB = processedFile.size / 1024;
      console.log(`[COMPRESS] 압축 완료: ${compressedSizeKB.toFixed(1)}KB (압축률: ${((1 - processedFile.size / file.size) * 100).toFixed(1)}%)`);
    } else {
      console.log(`[COMPRESS] 1MB 미만: ${originalSizeKB.toFixed(1)}KB, 압축 생략`);
    }

    // Storage 경로 설정 및 업로드
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
    
    // Storage 관련 에러 상세 분석
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
      alert(`이미지 업로드에 실패했습니다: ${err.message}\n\n콘솔의 [UPLOAD] failed 로그를 확인해주세요.`);
    }
    throw err;
  }
};

// Quill 이미지 핸들러
export const useImageHandler = () => {
  return useCallback(() => {
    console.log('[imageHandler] called - 이미지 핸들러 시작');
    
    // 에디터 참조 가져오기 (여러 방법 시도)
    let editor = null;
    if (window.quillEditor) {
      editor = window.quillEditor;
      console.log('[imageHandler] window.quillEditor에서 에디터 찾음');
      
      // 에디터 인스턴스에 직접 이미지 핸들러 등록
      try {
        if (editor && editor.getModule) {
          const toolbar = editor.getModule('toolbar');
          if (toolbar && toolbar.addHandler) {
            toolbar.addHandler('image', () => {
              console.log('[toolbar] 이미지 핸들러가 툴바에서 호출됨');
            });
          }
        }
      } catch (error) {
        console.warn('툴바 핸들러 등록 중 오류:', error);
      }
    } else {
      // DOM에서 직접 찾기
      const quillElement = document.querySelector('.ql-editor');
      if (quillElement && quillElement.__quill) {
        editor = quillElement.__quill;
        console.log('[imageHandler] DOM에서 에디터 찾음');
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

    console.log('[imageHandler] 파일 선택 다이얼로그 열기');
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      console.log('[imageHandler] onchange - 파일 선택됨');
      const file = input.files && input.files[0];
      if (!file) {
        console.log('[imageHandler] no file selected');
        return;
      }

      console.log('[imageHandler] 선택된 파일 정보:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      try {
        console.log('[imageHandler] handleImageUpload 호출 시작');
        const url = await handleImageUpload(file);
        console.log('[imageHandler] handleImageUpload 완료, URL:', url);
        
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
          console.log('[imageHandler] 이미지 삽입 위치:', range.index);
          
          // 현재 선택된 블록의 정렬 상태 확인
          const [line] = currentEditor.getLine(range.index);
          const formats = line ? line.formats() : {};
          const currentAlign = formats.align || '';
          
          // 이미지 삽입
          currentEditor.insertEmbed(range.index, 'image', url, 'user');
          
          // 정렬이 설정되어 있다면 이미지에도 적용
          if (currentAlign) {
            // 이미지 삽입 후 정렬 적용
            setTimeout(() => {
              const newRange = { index: range.index, length: 1 };
              currentEditor.formatLine(newRange.index, newRange.length, 'align', currentAlign);
              console.log('[imageHandler] 이미지 정렬 적용:', currentAlign);
            }, 10);
          }
          
          currentEditor.setSelection(range.index + 1, 0);
          console.log('[imageHandler] 이미지 삽입 성공');
        } else {
          console.error('[imageHandler] editor still not found after upload');
          alert('에디터를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        }
      } catch (err) {
        console.error('[imageHandler] 이미지 업로드 실패:', err);
        alert('이미지 삽입에 실패했습니다: ' + err.message);
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
export const useQuillModules = () => {
  return useMemo(
    () => {
      try {
        // Quill 핸들러 모듈 초기화
        initializeQuillHandlers();

        return {
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
            ['link', 'image', 'video', 'formula'],
            
            // 5행: 특수 기능
            ['clean'],
          ],
          // 핸들러를 직접 설정하지 않고, 에디터 인스턴스에서 설정
          // handlers: { 
          //   image: imageHandler, 
          // },
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
        };
      } catch (error) {
        console.error('Quill 모듈 설정 중 오류 발생:', error);
        // 기본 모듈 설정 반환
        return {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'image'],
            ['clean']
          ]
        };
      }
    },
    [] // imageHandler 의존성 제거
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
  'link', 'image', 'video', 'formula'
];

// 툴바 설정을 위한 커스텀 훅
export const useQuillToolbar = () => {
  // 컴포넌트 마운트 시 Quill 핸들러 모듈 초기화
  useEffect(() => {
    try {
      initializeQuillHandlers();
    } catch (error) {
      console.warn('Quill 핸들러 초기화 중 오류:', error);
    }
  }, []);

  const imageHandler = useImageHandler();
  const modules = useQuillModules(); // imageHandler 매개변수 제거

  return {
    modules,
    formats: quillFormats,
    handleImageUpload,
    imageHandler,
  };
};
