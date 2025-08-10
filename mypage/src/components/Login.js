import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.token); // Use the login function from AuthContext
        alert(data.message);
        navigate('/'); // Redirect to home page on successful login
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred during login.');
    }
  };

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
        navigate('/');
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
    <div className="container mt-5">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="usernameInput" className="form-label">Username</label>
          <input 
            type="text" 
            className="form-control" 
            id="usernameInput" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
          />
        </div>
        <div className="mb-3">
          <label htmlFor="passwordInput" className="form-label">Password</label>
          <input 
            type="password" 
            className="form-control" 
            id="passwordInput" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit" className="btn btn-primary">Login</button>
      </form>

      <hr className="my-4" />

      <h3>Or login with Google</h3>
      <GoogleLogin
        onSuccess={handleGoogleLoginSuccess}
        onError={handleGoogleLoginError}
      />
    </div>
  );
}

export default Login;