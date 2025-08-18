import { useState, useEffect, useRef, useCallback } from 'react';

export const useLazyLoading = (options = {}) => {
  const {
    rootMargin = '50px',
    threshold = 0.1,
    fallback = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+'
  } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef(null);
  const observerRef = useRef(null);

  const handleIntersection = useCallback((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setIsIntersecting(true);
        if (observerRef.current) {
          observerRef.current.unobserve(entry.target);
        }
      }
    });
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Intersection Observer 설정
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold
    });

    observer.observe(element);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, rootMargin, threshold]);

  const reset = useCallback(() => {
    setIsLoaded(false);
    setHasError(false);
    setIsIntersecting(false);
  }, []);

  return {
    elementRef,
    isLoaded,
    hasError,
    isIntersecting,
    handleLoad,
    handleError,
    reset,
    fallback
  };
};

export default useLazyLoading;
