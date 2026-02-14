import { useCallback, useEffect } from 'react';
import { convertHeicToJpeg } from '../utils/media';
import { setupResponsiveImageSizing } from '../utils/imageSizing';

function useQuillEditorBridge({
  quillRef,
  enabled = true,
  content,
  onPendingImage,
  onOpenFormulaEditor,
}) {
  const handleImageInsert = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.click();

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        const processedFile = await convertHeicToJpeg(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          const tempUrl = event.target?.result;
          if (!tempUrl) return;

          onPendingImage?.({ file: processedFile, tempUrl });
          const editor = quillRef.current?.getEditor();
          if (!editor) return;

          const range = editor.getSelection(true) || { index: editor.getLength() };
          editor.insertEmbed(range.index, 'image', tempUrl, 'user');
          editor.setSelection(range.index + 1, 0);
        };
        reader.readAsDataURL(processedFile);
      } catch (error) {
        alert(`이미지 처리 실패: ${error.message}`);
      }
    };
  }, [onPendingImage, quillRef]);

  useEffect(() => {
    if (!enabled) return undefined;
    let retryTimer;

    const setupEditor = () => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return false;

      window.quillEditor = editor;
      window.openFormulaEditor = (initialValue, onSaveCallback) => {
        onOpenFormulaEditor?.(initialValue, onSaveCallback);
      };
      editor.getModule('toolbar')?.addHandler('image', handleImageInsert);
      return true;
    };

    const timer = setTimeout(() => {
      if (!setupEditor()) {
        retryTimer = setTimeout(setupEditor, 300);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      window.openFormulaEditor = null;
    };
  }, [enabled, handleImageInsert, onOpenFormulaEditor, quillRef]);

  useEffect(() => {
    if (!enabled) return undefined;
    const editor = quillRef.current?.getEditor();
    if (!editor) return undefined;

    return setupResponsiveImageSizing({ root: editor.root });
  }, [content, enabled, quillRef]);
}

export default useQuillEditorBridge;
