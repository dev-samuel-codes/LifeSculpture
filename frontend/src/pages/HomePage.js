import React from 'react';
import HomeContentCards from '../components/home/HomeContentCards';
import mainBackgroundImage from '../assets/MainBackgroundImage.png';
import aiImage from '../assets/ai.jpg';
import codingImage from '../assets/coding.jpg';
import tipImage from '../assets/tip.jpg';
import travelImage from '../assets/travel.webp';
import '../style/pages/home/Home.css';

const CARD_CONFIG = [
  { key: 'coding', image: codingImage, link: '/study', title: '웹, 앱 개발' },
  { key: 'ai', image: aiImage, link: '/study', title: 'AI' },
  { key: 'travel', image: travelImage, link: '/blog', title: '여행' },
  { key: 'tip', image: tipImage, link: '/blog', title: '팁' },
];

function HomePage() {
  const mainSectionStyle = { backgroundImage: `url(${mainBackgroundImage})` };

  return (
    <div>
      <div
        className="main-section1"
        style={mainSectionStyle}
      >
        <h2>Every Day, A New Page</h2>
      </div>

      <div className="main-section2">
        <div className="main-section2-title">Contents</div>

        <HomeContentCards cards={CARD_CONFIG} />
      </div>
    </div>
  );
}

export default HomePage;
