// SettingsWriting 컴포넌트: 글 작성 페이지의 UI 레이아웃을 구성
import React from 'react';
import SettingsMenu from './SettingsMenu';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { registerTextEditorImageBlot } from '../text-editor/TextEditorCustomBlots';
import TextEditorFormulaDialog from '../text-editor/TextEditorFormulaDialog';
import useWritingEditor from './hooks/useWritingEditor';
import '../../style/components/settings/SettingsWriting.css';
import '../../style/components/editor/QuillToolbar.css';
import '../../style/components/editor/CustomFormulaEditor.css';
import '../../style/components/editor/RichText.css';

registerTextEditorImageBlot();

function SettingsWriting() {
  const {
    quillRef,
    state: {
      title,
      content,
      category,
      isPublic,
      editorHeight,
      isUploading,
      isFormulaEditorOpen,
      formulaInitialValue,
    },
    actions: {
      setTitle,
      setCategory,
      setIsPublic,
      handleContentChange,
      handleSubmit,
      handleFormulaSave,
      closeFormulaEditor,
    },
    quill: { modules, formats },
  } = useWritingEditor();

  return (
    <>
      <div className="container mt-4 h-100">
        <div className="row settings-row d-flex h-100">
          <SettingsMenu />
          <div className="col-md-9 h-100 flex-grow-1 settings-writing-container">
            <form onSubmit={handleSubmit} className="writing-form">
              <div className="writing-fields-group">
                <div className="row mb-3 writing-row">
                  <div className="col-md-9">
                    <label htmlFor="titleInput" className="form-label writing-label">Title</label>
                    <input type="text" className="form-control" id="titleInput" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="col-md-3">
                    <label htmlFor="categorySelect" className="form-label writing-label">Category</label>
                    <select className="form-select" id="categorySelect" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="study">Study</option>
                      <option value="blog">Blog</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <div
                    className="writing-editor-container"
                    style={{ '--rich-text-editor-height': editorHeight }}
                  >
                    <ReactQuill
                      ref={quillRef}
                      className="writing-editor rich-text-editor"
                      theme="snow"
                      value={content}
                      onChange={handleContentChange}
                      modules={modules}
                      formats={formats}
                      style={{ height: 'auto', '--rich-text-editor-height': editorHeight }}
                    />
                  </div>
                </div>
                <div className="writing-actions">
                  <div className="public-switch-container d-none d-md-flex">
                    <label className="switch">
                      <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                      <span className="slider round"></span>
                    </label>
                    <span className="ms-2">{isPublic ? '공개' : '비공개'}</span>
                  </div>
                  <button type="submit" className="btn btn-primary btn-primary-solid" disabled={isUploading}>
                    {isUploading ? '업로드 중...' : '게시하기'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      <TextEditorFormulaDialog
        isOpen={isFormulaEditorOpen}
        onClose={closeFormulaEditor}
        onSave={handleFormulaSave}
        initialValue={formulaInitialValue}
      />
    </>
  );
}

export default SettingsWriting;
