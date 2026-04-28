import React from 'react';
import PostEditorForm from './PostEditorForm';
import useWritingEditor from './hooks/useWritingEditor';
import '../../style/components/write/WritePostPage.css';
import '../../style/components/editor/QuillToolbar.css';
import '../../style/components/editor/CustomFormulaEditor.css';
import '../../style/components/editor/RichText.css';

function WritePostPage() {
  const {
    quillRef,
    state: {
      title,
      content,
      category,
      isPublic,
      tags,
      contentStyleSettings,
      editorHeight,
      isUploading,
      isFormulaEditorOpen,
      formulaInitialValue,
      draftStatus,
    },
    actions: {
      setTitle,
      setCategory,
      setIsPublic,
      setTags,
      setContentStyleSettings,
      handleContentChange,
      handleSubmit,
      handleFormulaSave,
      closeFormulaEditor,
    },
    quill: { modules, formats },
  } = useWritingEditor();

  const draftStatusMessage = (() => {
    switch (draftStatus) {
      case 'saving':
        return '임시저장 중...';
      case 'saved':
      case 'loaded':
        return '임시저장 완료';
      default:
        return '';
    }
  })();

  return (
    <PostEditorForm
      mode="create"
      title={title}
      content={content}
      category={category}
      isPublic={isPublic}
      tags={tags}
      contentStyleSettings={contentStyleSettings}
      editorHeight={editorHeight}
      isSubmitting={isUploading}
      statusMessage={draftStatusMessage}
      quillRef={quillRef}
      modules={modules}
      formats={formats}
      onTitleChange={setTitle}
      onContentChange={handleContentChange}
      onCategoryChange={setCategory}
      onPublicChange={setIsPublic}
      onTagsChange={setTags}
      onContentStyleSettingsChange={setContentStyleSettings}
      onSubmit={handleSubmit}
      formulaDialog={{
        isOpen: isFormulaEditorOpen,
        onClose: closeFormulaEditor,
        onSave: handleFormulaSave,
        initialValue: formulaInitialValue,
      }}
    />
  );
}

export default WritePostPage;
