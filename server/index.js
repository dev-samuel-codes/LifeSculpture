const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');

const app = express();
const port = 5000;
const SECRET_KEY = 'your_secret_key'; // In a real app, use a strong, environment-variable-based secret
const GOOGLE_CLIENT_ID = '473307280029-fp499tqn4dfiinq8itn67353ic0g1ud1.apps.googleusercontent.com';
const ADMIN_EMAIL = 'sksksjakskska@gmail.com'; // User's email to be made admin
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Hardcoded credentials for demonstration
  if (username === 'user' && password === 'password') {
    const role = 'user'; // Default role for regular login
    const name = 'Regular User'; // Default name for regular login
    const token = jwt.sign({ username, role, name }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.post('/auth/google', async (req, res) => {
  const { id_token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const userid = payload['sub'];
    const email = payload['email'];
    const name = payload['name']; // Extract name
    const picture = payload['picture']; // Extract picture

    let role = 'user'; // Default role
    if (email === ADMIN_EMAIL) {
      role = 'admin';
    }

    const token = jwt.sign({ userid, email, name, picture, role }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ message: 'Google login successful', token });
  } catch (error) {
    console.error('Google ID token verification failed:', error);
    res.status(401).json({ message: 'Google login failed' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
