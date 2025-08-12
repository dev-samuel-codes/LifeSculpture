import React, { useState } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, addDoc } from 'firebase/firestore';
import ReactQuill from 'react-quill-new'; // Using react-quill-new
import 'react-quill-new/dist/quill.snow.css'; // Import Quill's CSS
import '../style/SettingsWriting.css';

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // content will now hold HTML string
  const [category, setCategory] = useState('study'); // Default category

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image', 'code-block'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'code-block'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) {
      alert('Please select a category.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }
    if (!content.trim() || content === '<p><br></p>') { // Check for empty content from Quill
      alert('Please enter content.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, category), {
        title: title,
        content: content, // content is now HTML
        createdAt: new Date(),
        viewCount: 0,
      });
      console.log("Document written with ID: ", docRef.id);
      alert(`Content submitted successfully to ${category} collection!`);
      setTitle('');
      setContent('');
    } catch (e) {
      console.error("Error adding document: ", e);
      alert('Error submitting content.');
    }
  };

  return (
    <div className="container mt-4 h-100">
      <div className="row settings-row d-flex h-100">
        <SettingsMenu />
        <div className="col-md-9 h-100 flex-grow-1 settings-writing-container">
          <form onSubmit={handleSubmit}>
            <div className="row mb-3">
              <div className="col-md-9">
                <label htmlFor="titleInput" className="form-label">Title</label>
                <input 
                  type="text" 
                  className="form-control" 
                  id="titleInput" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required 
                />
              </div>
              <div className="col-md-3">
                <label htmlFor="categorySelect" className="form-label">Category</label>
                <select 
                  className="form-select" 
                  id="categorySelect" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="study">Study</option>
                  <option value="blog">Blog</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="contentInput" className="form-label">Content</label>
              <div className="react-quill">
                <ReactQuill 
                  theme="snow" 
                  value={content} 
                  onChange={setContent} 
                  modules={modules} 
                  formats={formats} 
                  style={{ height: '400px', marginBottom: '50px' }} // Added height and margin for editor
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Submit</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SettingsWriting;
