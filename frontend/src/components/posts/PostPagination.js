import React from 'react';

function PostPagination({ currentPage, totalPages, onPrevious, onNext, onSelect }) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Page navigation example" className="mt-4">
      <ul className="d-flex justify-content-center list-unstyled study-pagination">
        <li className={`me-1 ${currentPage === 1 ? 'disabled' : ''}`}>
          <button className="btn btn-secondary" onClick={onPrevious} disabled={currentPage === 1}>
            Previous
          </button>
        </li>

        {[...Array(totalPages)].map((_, index) => {
          const pageNumber = index + 1;
          const isActive = currentPage === pageNumber;
          return (
            <li key={pageNumber} className={`me-1 ${isActive ? 'active' : ''}`}>
              <button
                className={`btn ${isActive ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => onSelect(pageNumber)}
              >
                {pageNumber}
              </button>
            </li>
          );
        })}

        <li className={`${currentPage === totalPages ? 'disabled' : ''}`}>
          <button
            className="btn btn-primary"
            onClick={onNext}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default PostPagination;
