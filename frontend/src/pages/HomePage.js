import React, { useMemo } from 'react';
import HomeContentCards from '../components/home/HomeContentCards';
import useStorageImage from '../hooks/useStorageImage';
import '../style/pages/home/Home.css';

const CARD_CONFIG = [
  { key: 'coding', link: '/study', title: '웹, 앱 개발' },
  { key: 'ai', link: '/study', title: 'AI' },
  { key: 'travel', link: '/blog', title: '여행' },
  { key: 'tip', link: '/blog', title: '팁' },
];

function HomePage() {
  const mainBackground = useStorageImage('image/MainBackgroundImage.png');
  const codingImage = useStorageImage('image/coding.jpg');
  const aiImage = useStorageImage('image/ai.jpg');
  const travelImage = useStorageImage('image/travel.jpg');
  const tipImage = useStorageImage('image/tip.jpg');

  const cards = useMemo(() => {
    const imageMap = {
      coding: codingImage,
      ai: aiImage,
      travel: travelImage,
      tip: tipImage,
    };
    return CARD_CONFIG.map((config) => ({
      ...config,
      image: imageMap[config.key],
    }));
  }, [codingImage, aiImage, travelImage, tipImage]);

  const mainSectionStyle = mainBackground.url
    ? { backgroundImage: `url(${mainBackground.url})` }
    : undefined;

  return (
    <div>
      <div
        className="main-section1"
        style={mainSectionStyle}
        data-loading={mainBackground.loading || !mainBackground.url}
      >
        <h2>Every Day, A New Page</h2>
      </div>

      <div className="main-section2">
        <div className="main-section2-title">Contents</div>

        <HomeContentCards cards={cards} />
      </div>
    </div>
  );
}

export default HomePage;
