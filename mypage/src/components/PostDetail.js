import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import '../style/PostDetail.css';

function PostDetail() {
  const { category, id } = useParams();
  const navigate = useNavigate();
  const { role } = useContext(AuthContext);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPostAndIncrementView = async () => {
      try {
        const docRef = doc(db, category, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const currentViewCount = docSnap.data().viewCount || 0;
          // Increment view count in Firestore
          await updateDoc(docRef, {
            viewCount: increment(1)
          });
          // Update local state with incremented view count
          setPost({ id: docSnap.id, ...docSnap.data(), viewCount: currentViewCount + 1 });
        } else {
          setError("Post not found.");
        }
      } catch (err) {
        console.error("Error fetching or updating post:", err);
        setError("Failed to load post.");
      } finally {
        setLoading(false);
      }
    };

    fetchPostAndIncrementView();
  }, [category, id]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await deleteDoc(doc(db, category, id));
        alert('Post deleted successfully!');
        navigate(`/${category}`); // Redirect to the category list page
      } catch (e) {
        console.error("Error deleting document: ", e);
        alert('Error deleting post.');
      }
    }
  };

  if (loading) {
    return <div className="post-detail-container">Loading post...</div>;
  }

  if (error) {
    return <div className="post-detail-container">Error: {error}</div>;
  }

  if (!post) {
    return <div className="post-detail-container">Post not found.</div>;
  }

  return (
    <div className="post-detail-container">
      <div className="post-header">
        <h2>{post.title}</h2>
        {role === 'admin' && (
          <div className="post-actions">
            <button className="btn btn-warning btn-sm me-2" onClick={() => navigate(`/edit-post/${category}/${id}`)}>
              Edit
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>
      <p className="post-meta">
        {new Date(post.createdAt.toDate()).toLocaleString()} | Views: {post.viewCount}
      </p>
      <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
    </div>
  );
}

export default PostDetail;