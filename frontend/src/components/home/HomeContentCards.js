import React from 'react';
import { Link } from 'react-router-dom';
import LazyBackgroundImage from '../media/LazyBackgroundImage';

const linkStyle = Object.freeze({ textDecoration: 'none', display: 'block', height: '100%' });

function HomeContentCards({ cards }) {
  return (
    <div className="main-section2-content">
      {cards.map(({ key, image, link, title }) => (
        <LazyBackgroundImage
          key={key}
          src={image}
          className="main-card"
        >
          <Link to={link} style={linkStyle}>
            <div className="main-card-overlay"></div>
            <div className="main-card-body">
              <h3>{title}</h3>
            </div>
          </Link>
        </LazyBackgroundImage>
      ))}
    </div>
  );
}

export default HomeContentCards;
