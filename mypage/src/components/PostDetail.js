import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

function PostDetail() {
  const { category, id } = useParams();
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

  if (loading) {
    return <div className="container mt-4">Loading post...</div>;
  }

  if (error) {
    return <div className="container mt-4 text-danger">Error: {error}</div>;
  }

  if (!post) {
    return <div className="container mt-4">Post not found.</div>;
  }

  return (
    <div className="container mt-4">
      <h2>{post.title}</h2>
      <p className="text-muted">
        {new Date(post.createdAt.toDate()).toLocaleString()} | Views: {post.viewCount}
      </p>
      <hr />
      <p>{post.content}</p>
    </div>
  );
}

export default PostDetail;