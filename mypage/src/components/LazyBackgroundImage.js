import React, { useState, useRef, useEffect } from 'react';

const LazyBackgroundImage = ({ 
  src, 
  children, 
  className = '', 
  style = {}, 
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
  onLoad,
  onError,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, [src]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !src) return;

    // Intersection Observer를 사용한 지연 로딩
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 컨테이너가 뷰포트에 보이면 이미지 로딩 시작
            const img = new Image();
            img.onload = () => {
              setIsLoaded(true);
              if (onLoad) onLoad();
            };
            img.onerror = () => {
              setHasError(true);
              if (onError) onError();
            };
            img.src = src;
            observer.unobserve(container);
          }
        });
      },
      {
        rootMargin: '50px', // 뷰포트 밖 50px 전에 미리 로딩
        threshold: 0.1
      }
    );

    observer.observe(container);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src, onLoad, onError]);

  const backgroundStyle = {
    ...style,
    backgroundImage: isLoaded 
      ? `url(${src})`
      : `url(${placeholder})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transition: 'all 0.3s ease-in-out',
    filter: isLoaded ? 'none' : 'blur(1px)',
  };

  return (
    <div
      ref={containerRef}
      className={`lazy-background-image ${className} ${isLoaded ? 'loaded' : ''} ${hasError ? 'error' : ''}`}
      style={backgroundStyle}
      {...props}
    >
      {children}
    </div>
  );
};

export default LazyBackgroundImage;
