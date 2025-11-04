import React from 'react';
import { Link } from 'react-router-dom';
import { LazyBackgroundImage } from '../components';
import useStorageImage from '../hooks/useStorageImage';
import '../style/Home.css';

function HomePage() {
  const mainBackground = useStorageImage('image/MainBackgroundImage.png');
  const codingImage = useStorageImage('image/coding.jpg');
  const aiImage = useStorageImage('image/ai.jpg');
  const travelImage = useStorageImage('image/travel.jpg');
  const tipImage = useStorageImage('image/tip.jpg');

  return (
    <div>
      <div
        className="main-section1"
        style={mainBackground.url ? { backgroundImage: `url(${mainBackground.url})` } : undefined}
        data-loading={mainBackground.loading || !mainBackground.url}
      >
        <h2>Every Day, A New Page</h2>
      </div>

      <div className="main-section2">
        <div className="main-section2-title">Contents</div>

        <div className="main-section2-content">
          <LazyBackgroundImage
            src={codingImage.url}
            className="main-card"
            data-loading={codingImage.loading || !codingImage.url}
          >
            <Link to="/study" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>웹, 앱 개발</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          <LazyBackgroundImage
            src={aiImage.url}
            className="main-card"
            data-loading={aiImage.loading || !aiImage.url}
          >
            <Link to="/study" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>AI</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          <LazyBackgroundImage
            src={travelImage.url}
            className="main-card"
            data-loading={travelImage.loading || !travelImage.url}
          >
            <Link to="/blog" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>여행</h3>
              </div>
            </Link>
          </LazyBackgroundImage>

          <LazyBackgroundImage
            src={tipImage.url}
            className="main-card"
            data-loading={tipImage.loading || !tipImage.url}
          >
            <Link to="/blog" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
              <div className="main-card-overlay"></div>
              <div className="main-card-body">
                <h3>팁</h3>
              </div>
            </Link>
          </LazyBackgroundImage>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
