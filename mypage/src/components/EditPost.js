import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

function EditPost() {
  const { category, id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docRef = doc(db, category, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const postData = docSnap.data();
          setTitle(postData.title);
          setContent(postData.content); // Content is HTML string
        } else {
          setError("Post not found.");
        }
      } catch (err) {
        console.error("Error fetching post for edit:", err);
        setError("Failed to load post for editing.");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [category, id]);

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
    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }
    if (!content.trim() || content === '<p><br></p>') { // Check for empty content from Quill
      alert('Please enter content.');
      return;
    }

    try {
      const docRef = doc(db, category, id);
      await updateDoc(docRef, {
        title: title,
        content: content, // Content is HTML
      });
      alert('Post updated successfully!');
      navigate(`/posts/${category}/${id}`); // Redirect to post detail page
    } catch (e) {
      console.error("Error updating document: ", e);
      alert('Error updating post.');
    }
  };

  if (loading) {
    return <div className="container mt-4">Loading post for editing...</div>;
  }

  if (error) {
    return <div className="container mt-4 text-danger">Error: {error}</div>;
  }

  if (!title && !content) {
    return <div className="container mt-4">Post not found or empty.</div>;
  }

  return (
    <div className="container mt-4">
      <h2>Edit Post ({category})</h2>
      <form onSubmit={handleSubmit}>
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
          <ReactQuill 
            theme="snow" 
            value={content} 
            onChange={setContent} 
            modules={modules} 
            formats={formats} 
            style={{ height: '200px', marginBottom: '50px' }} // Added height and margin for editor
          />
        </div>
        <button type="submit" className="btn btn-primary">Update Post</button>
      </form>
    </div>
  );
}

export default EditPost;
