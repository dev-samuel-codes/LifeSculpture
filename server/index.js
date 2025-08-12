require('dotenv').config(); // Load environment variables from .env file
console.log('dotenv config loaded. Process env GOOGLE_CLIENT_ID_BACKEND:', process.env.GOOGLE_CLIENT_ID_BACKEND);

const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const admin = require('firebase-admin');

// Path to your service account key file from environment variable
const serviceAccountPath = process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';
const serviceAccount = require(serviceAccountPath); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const dbAdmin = admin.firestore(); // Firestore instance for Admin SDK

const app = express();
const port = 5000;
const SECRET_KEY = process.env.JWT_SECRET_KEY || 'your_secret_key'; 
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID_BACKEND || 'default_google_client_id';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'default_admin@example.com';
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

// Serve static files from the 'assets' directory
app.use('/assets', express.static('assets'));

// Helper function to save/update user in Firestore
const saveUserToFirestore = async (userData) => {
  try {
    // Use email as document ID for uniqueness and easy lookup
    await dbAdmin.collection('users').doc(userData.email).set(userData, { merge: true });
    console.log(`User ${userData.email} saved/updated in Firestore.`);
  } catch (error) {
    console.error('Error saving user to Firestore:', error);
  }
};

app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

app.post('/auth/firebase', async (req, res) => {
  const { idToken } = req.body; // Expecting Firebase ID Token from frontend

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name || email; // Use name from token or email
    const picture = decodedToken.picture || null; // Use picture from token if available

    let role = 'user'; // Default role
    if (email === ADMIN_EMAIL) {
      role = 'admin';
    }

    // Create a custom JWT for your application's session management
    const appToken = jwt.sign({ uid, email, name, picture, role }, SECRET_KEY, { expiresIn: '1h' });

    // Save/update user in Firestore (optional, if you need to store user profiles)
    await saveUserToFirestore({ email, name, role, picture, userid: uid });

    res.json({ message: 'Firebase authentication successful', token: appToken });
  } catch (error) {
    console.error('Firebase ID token verification failed:', error);
    res.status(401).json({ message: 'Firebase authentication failed' });
  }
});

app.post('/auth/google', async (req, res) => {
  const { id_token } = req.body;

  try {
    console.log('Backend GOOGLE_CLIENT_ID (at runtime):', GOOGLE_CLIENT_ID);
    console.log('Received ID Token (first 50 chars):', id_token.substring(0, 50) + '...');
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

    // Save/update user in Firestore
    await saveUserToFirestore({ email, name, role, picture, userid });

    res.json({ message: 'Google login successful', token });
  } catch (error) {
    console.error('Google ID token verification failed:', error);
    res.status(401).json({ message: 'Google login failed' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
