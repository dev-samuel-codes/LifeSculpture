import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const POSTS_PER_PAGE = 6;

// Example keywords - In a real app, these might come from a database or be dynamically generated
const KEYWORDS = ['React', 'Firebase', 'JavaScript', 'Node.js', 'Web Development', 'CSS'];

function Study() {
  const [allPosts, setAllPosts] = useState([]); // Stores all fetched posts
  const [filteredPosts, setFilteredPosts] = useState([]); // Posts after keyword filtering
  const [currentPosts, setCurrentPosts] = useState([]); // Posts for the current page
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedKeyword, setSelectedKeyword] = useState(null);

  useEffect(() => {
    const fetchAllPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, "study"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedPosts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllPosts(fetchedPosts);
      } catch (err) {
        console.error("Error fetching study posts:", err);
        setError("Failed to load study posts.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllPosts();
  }, []);

  useEffect(() => {
    // Filter posts based on selectedKeyword
    let postsToFilter = allPosts;
    if (selectedKeyword) {
      postsToFilter = allPosts.filter(post => 
        post.title.toLowerCase().includes(selectedKeyword.toLowerCase())
      );
    }
    setFilteredPosts(postsToFilter);
    setCurrentPage(1); // Reset to first page on filter change
  }, [allPosts, selectedKeyword]);

  useEffect(() => {
    // Slice posts for the current page whenever filteredPosts or currentPage changes
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    setCurrentPosts(filteredPosts.slice(startIndex, endIndex));
  }, [filteredPosts, currentPage]);

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => prev - 1);
  };

  const handlePageClick = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);

  if (loading) {
    return <div className="container mt-4">Loading study posts...</div>;
  }

  if (error) {
    return <div className="container mt-4 text-danger">Error: {error}</div>;
  }

  return (
    <div className="container mt-4">
      <h2>Study Page</h2>
      <div className="row">
        <div className="col-md-3">
          <h3>Keywords</h3>
          <div className="list-group">
            <button 
              className={`list-group-item list-group-item-action ${selectedKeyword === null ? 'active' : ''}`}
              onClick={() => setSelectedKeyword(null)}
            >
              All Posts
            </button>
            {KEYWORDS.map(keyword => (
              <button 
                key={keyword}
                className={`list-group-item list-group-item-action ${selectedKeyword === keyword ? 'active' : ''}`}
                onClick={() => setSelectedKeyword(keyword)}
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
        <div className="col-md-9">
          {currentPosts.length === 0 && filteredPosts.length === 0 ? (
            <p>No study posts found.</p>
          ) : (
            <div className="row">
              {currentPosts.map(post => (
                <div key={post.id} className="col-12 mb-3">
                  <Link to={`/posts/study/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card">
                      <div className="card-body">
                        <h5 className="card-title">{post.title}</h5>
                        <p className="card-text"><small className="text-muted">{new Date(post.createdAt.toDate()).toLocaleString()} | Views: {post.viewCount || 0}</small></p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
          <nav aria-label="Page navigation example" className="mt-4">
            <ul className="d-flex justify-content-center list-unstyled">
              <li className={`page-item me-1 ${currentPage === 1 || filteredPosts.length === 0 ? 'disabled' : ''}`}>
                <button className="btn btn-secondary" onClick={handlePrevPage} disabled={currentPage === 1 || filteredPosts.length === 0}>Previous</button>
              </li>
              {[...Array(totalPages)].map((_, index) => (
                <li key={index} className={`page-item me-1 ${currentPage === index + 1 ? 'active' : ''}`}>
                  <button className="btn btn-outline-primary" onClick={() => handlePageClick(index + 1)}>{index + 1}</button>
                </li>
              ))}
              <li className={`page-item ${currentPage === totalPages || filteredPosts.length === 0 ? 'disabled' : ''}`}>
                <button className="btn btn-primary" onClick={handleNextPage} disabled={currentPage === totalPages || filteredPosts.length === 0}>Next</button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default Study;
