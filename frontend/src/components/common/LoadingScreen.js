import React, { useEffect, useState } from 'react';
import '../../style/components/common/LoadingScreen.css';

const LoadingScreen = () => {
  const [circles, setCircles] = useState([]);

  // 랜덤 색상 생성 함수
  const getRandomColor = () => {
    const colors = [
      'rgba(255,99,132,0.5)',
      'rgba(54,162,235,0.5)',
      'rgba(75,192,192,0.5)',
      'rgba(153,102,255,0.5)',
      'rgba(255,159,64,0.5)'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // 랜덤 위치 생성 함수
  const getRandomPosition = () => {
    return {
      x: Math.random() * 100,
      y: Math.random() * 100
    };
  };

  // 랜덤 크기 생성 함수
  const getRandomSize = () => {
    return 200 + Math.random() * 400; // 200px에서 600px 사이
  };

  useEffect(() => {
    // 초기 원형 생성 (5개 생성)
    const initialCircles = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      color: getRandomColor(),
      position: getRandomPosition(),
      size: getRandomSize(),
      delay: i * 0.1 // 각 원형마다 0.1초씩 차이를 두어 순차 시작 (전체 0.4초)
    }));
    setCircles(initialCircles);
  }, []);

  return (
    <div className="loading-screen">
      <div className="gradient-container">
        {circles.map(circle => (
          <div
            key={circle.id}
            className="gradient-circle"
            style={{
              background: `radial-gradient(circle, ${circle.color} 0%, rgba(255,255,255,0) 70%)`,
              width: `${circle.size}px`,
              height: `${circle.size}px`,
              left: `${circle.position.x}%`,
              top: `${circle.position.y}%`,
              animationDelay: `${circle.delay}s`
            }}
          />
        ))}
      </div>
      <div className="loading-text">Loading</div>
    </div>
  );
};

export default LoadingScreen;