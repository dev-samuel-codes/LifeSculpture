import React, { useState } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, addDoc } from 'firebase/firestore';

function SettingsWriting() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('study'); // Default category

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) {
      alert('Please select a category.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, category), {
        title: title,
        content: content,
        createdAt: new Date(),
        viewCount: 0, // Initialize viewCount to 0
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
      <h2>Settings</h2>
      <div className="row settings-row d-flex h-100">
        <SettingsMenu />
        <div className="col-md-9 h-100 flex-grow-1">
          <h3>Write New Content</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
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
            <div className="mb-3">
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
            <div className="mb-3">
              <label htmlFor="contentInput" className="form-label">Content</label>
              <textarea 
                className="form-control" 
                id="contentInput" 
                rows="10" 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                required 
              ></textarea>
            </div>
            <button type="submit" className="btn btn-primary">Submit</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SettingsWriting;
