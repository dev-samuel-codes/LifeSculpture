import React, { useContext } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function GoogleLoginButton() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    console.log('Google Login Success:', credentialResponse);
    try {
      const response = await fetch('http://localhost:5000/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id_token: credentialResponse.credential }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.token);
        alert(data.message);
        navigate('/'); // Redirect to home page on successful login
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Google login backend error:', error);
      alert('An error occurred during Google login.');
    }
  };

  const handleGoogleLoginError = () => {
    console.log('Google Login Failed');
    alert('Google login failed.');
  };

  return (
    <GoogleLogin
      onSuccess={handleGoogleLoginSuccess}
      onError={handleGoogleLoginError}
    />
  );
}

export default GoogleLoginButton;
