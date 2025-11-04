import React from 'react';
import '../../style/Connect.css';

function Connect() {
  return (
    <div className="connect-section">
      <h2 className="connect-title">Connect</h2>
      <div className="connect-container">
        <a href="https://mail.naver.com" target="_blank" rel="noopener noreferrer" className="connect-box naver">
          <i className="icon-placeholder"></i>
          <h3>Naver Mail</h3>
          <p>greenchoiid@naver.com</p>
        </a>
        <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer" className="connect-box gmail">
          <i className="icon-placeholder"></i>
          <h3>Gmail</h3>
          <p>sksksjakskska@gmail.com</p>
        </a>
        <a href="https://www.instagram.com/samuel._.0fficial/" target="_blank" rel="noopener noreferrer" className="connect-box instagram">
          <i className="icon-placeholder"></i>
          <h3>Instagram</h3>
          <p>@samuel._.official</p>
        </a>
      </div>
    </div>
  );
}

export default Connect;
