require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const admin = require('firebase-admin');

const REQUIRED_ENV_KEYS = [
  'SERVICE_ACCOUNT_KEY_PATH',
  'JWT_SECRET_KEY',
  'GOOGLE_CLIENT_ID_BACKEND',
  'ADMIN_EMAIL',
];

const missingEnv = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  throw new Error(`[server] 필수 환경변수가 누락되었습니다: ${missingEnv.join(', ')}`);
}

const serviceAccountPath = path.resolve(process.cwd(), process.env.SERVICE_ACCOUNT_KEY_PATH);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`[server] 서비스 계정 키 파일을 찾을 수 없습니다: ${serviceAccountPath}`);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  throw new Error(`[server] 서비스 계정 키 JSON 파싱 실패: ${error.message}`);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const dbAdmin = admin.firestore();

const app = express();
const port = Number(process.env.PORT || 5000);
const SECRET_KEY = process.env.JWT_SECRET_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID_BACKEND;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

const corsOptions = {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const saveUserToFirestore = async (userData) => {
  const documentId = userData.userid || userData.uid;
  if (!documentId) {
    console.warn('[auth] 사용자 문서를 저장할 수 없습니다. uid가 제공되지 않았습니다.');
    return;
  }

  try {
    await dbAdmin
      .collection('users')
      .doc(documentId)
      .set(
        {
          email: userData.email ?? null,
          name: userData.name ?? null,
          role: userData.role ?? 'user',
          picture: userData.picture ?? null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {
    console.error('Error saving user to Firestore:', error);
  }
};

app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

app.post('/auth/firebase', async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) {
    res.status(400).json({ message: 'idToken is required' });
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name || email;
    const picture = decodedToken.picture || null;
    const role = email === ADMIN_EMAIL ? 'admin' : 'user';

    const appToken = jwt.sign({ uid, email, name, picture, role }, SECRET_KEY, {
      expiresIn: '1h',
    });

    await saveUserToFirestore({ uid, email, name, role, picture });

    res.json({ message: 'Firebase authentication successful', token: appToken });
  } catch (error) {
    console.error('Firebase ID token verification failed:', error);
    res.status(401).json({ message: 'Firebase authentication failed' });
  }
});

app.post('/auth/google', async (req, res) => {
  const { id_token: idToken } = req.body || {};
  if (!idToken) {
    res.status(400).json({ message: 'id_token is required' });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const uid = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;
    const role = email === ADMIN_EMAIL ? 'admin' : 'user';

    const token = jwt.sign({ uid, email, name, picture, role }, SECRET_KEY, {
      expiresIn: '1h',
    });

    await saveUserToFirestore({ uid, email, name, role, picture });

    res.json({ message: 'Google login successful', token });
  } catch (error) {
    console.error('Google ID token verification failed:', error);
    res.status(401).json({ message: 'Google login failed' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
