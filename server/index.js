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
app.use(bodyParser.json({ limit: '10mb' }));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const POST_CATEGORIES = new Set(['blog', 'study']);
const BATCH_WRITE_LIMIT = 450;
const INDEX_FIELDS = ['title', 'tags', 'createdAt', 'viewCount', 'likeCount', 'isPublic'];

const sanitizePostUpdates = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const allowedKeys = new Set(['title', 'content', 'tags', 'isPublic', 'contentStyleSettings']);
  const updates = {};

  for (const [key, value] of Object.entries(input)) {
    if (!allowedKeys.has(key) || value === undefined) {
      continue;
    }
    updates[key] = value;
  }

  return updates;
};

const isValidPostCategory = (category) =>
  typeof category === 'string' && POST_CATEGORIES.has(category.trim());

const createBatchWriter = (firestore) => {
  let batch = firestore.batch();
  let operationCount = 0;

  const queueSet = (ref, data, options) => {
    if (options) {
      batch.set(ref, data, options);
    } else {
      batch.set(ref, data);
    }
    operationCount += 1;
  };

  const queueDelete = (ref) => {
    batch.delete(ref);
    operationCount += 1;
  };

  const flush = async () => {
    if (operationCount === 0) {
      return;
    }
    await batch.commit();
    batch = firestore.batch();
    operationCount = 0;
  };

  const queueSetWithAutoFlush = async (ref, data, options) => {
    queueSet(ref, data, options);
    if (operationCount >= BATCH_WRITE_LIMIT) {
      await flush();
    }
  };

  const queueDeleteWithAutoFlush = async (ref) => {
    queueDelete(ref);
    if (operationCount >= BATCH_WRITE_LIMIT) {
      await flush();
    }
  };

  return {
    set: queueSetWithAutoFlush,
    delete: queueDeleteWithAutoFlush,
    flush,
  };
};

const buildIndexPayload = (postData, sourceIndexData = {}) => {
  const payload = {};

  INDEX_FIELDS.forEach((field) => {
    if (postData[field] !== undefined) {
      payload[field] = postData[field];
      return;
    }
    if (sourceIndexData[field] !== undefined) {
      payload[field] = sourceIndexData[field];
    }
  });

  if (payload.viewCount === undefined) payload.viewCount = 0;
  if (payload.likeCount === undefined) payload.likeCount = 0;
  if (payload.tags === undefined) payload.tags = [];
  if (payload.isPublic === undefined) payload.isPublic = true;

  return payload;
};

const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
};

const resolveUserRole = async ({ uid, email }) => {
  if (email === ADMIN_EMAIL) {
    return 'admin';
  }

  try {
    const snap = await dbAdmin.collection('users').doc(uid).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data()?.role ?? null;
  } catch (error) {
    console.error('[auth] 사용자 역할 조회 실패:', error);
    return null;
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ message: 'Authorization header is required' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const role = await resolveUserRole({ uid: decoded.uid, email: decoded.email });

    if (role !== 'admin') {
      res.status(403).json({ message: 'Admin role required' });
      return;
    }

    req.auth = decoded;
    next();
  } catch (error) {
    console.error('[auth] 관리자 인증 실패:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

const moveCommentsAndLikes = async ({ fromCategory, toCategory, postId }) => {
  const sourceCommentsRef = dbAdmin.collection(fromCategory).doc(postId).collection('comments');
  const targetCommentsRef = dbAdmin.collection(toCategory).doc(postId).collection('comments');

  const commentsSnapshot = await sourceCommentsRef.get();
  if (commentsSnapshot.empty) {
    return { commentCount: 0, likeCount: 0 };
  }

  const copiedLikes = [];
  const copyWriter = createBatchWriter(dbAdmin);
  let likeCount = 0;

  for (const commentDoc of commentsSnapshot.docs) {
    const targetCommentRef = targetCommentsRef.doc(commentDoc.id);
    await copyWriter.set(targetCommentRef, commentDoc.data());

    const likesSnapshot = await commentDoc.ref.collection('likes').get();
    for (const likeDoc of likesSnapshot.docs) {
      await copyWriter.set(targetCommentRef.collection('likes').doc(likeDoc.id), likeDoc.data());
      copiedLikes.push({
        commentId: commentDoc.id,
        likeId: likeDoc.id,
      });
      likeCount += 1;
    }
  }
  await copyWriter.flush();

  const deleteWriter = createBatchWriter(dbAdmin);
  for (const { commentId, likeId } of copiedLikes) {
    await deleteWriter.delete(
      sourceCommentsRef.doc(commentId).collection('likes').doc(likeId),
    );
  }
  for (const commentDoc of commentsSnapshot.docs) {
    await deleteWriter.delete(commentDoc.ref);
  }
  await deleteWriter.flush();

  return {
    commentCount: commentsSnapshot.size,
    likeCount,
  };
};

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

app.post('/posts/move-category', requireAdmin, async (req, res) => {
  const { postId, fromCategory, toCategory, data } = req.body || {};
  const normalizedPostId = typeof postId === 'string' ? postId.trim() : '';
  const sourceCategory = typeof fromCategory === 'string' ? fromCategory.trim() : '';
  const targetCategory = typeof toCategory === 'string' ? toCategory.trim() : '';

  if (!normalizedPostId) {
    res.status(400).json({ message: 'postId is required' });
    return;
  }
  if (!isValidPostCategory(sourceCategory) || !isValidPostCategory(targetCategory)) {
    res.status(400).json({ message: 'Invalid category' });
    return;
  }
  if (sourceCategory === targetCategory) {
    res.status(400).json({ message: 'fromCategory and toCategory must be different' });
    return;
  }

  const sourcePostRef = dbAdmin.collection(sourceCategory).doc(normalizedPostId);
  const sourceIndexRef = dbAdmin
    .collection('post_index')
    .doc(sourceCategory)
    .collection('posts')
    .doc(normalizedPostId);
  const targetPostRef = dbAdmin.collection(targetCategory).doc(normalizedPostId);
  const targetIndexRef = dbAdmin
    .collection('post_index')
    .doc(targetCategory)
    .collection('posts')
    .doc(normalizedPostId);

  try {
    const [sourcePostSnap, sourceIndexSnap, targetPostSnap] = await Promise.all([
      sourcePostRef.get(),
      sourceIndexRef.get(),
      targetPostRef.get(),
    ]);

    if (!sourcePostSnap.exists) {
      res.status(404).json({ message: 'Post not found in source category' });
      return;
    }
    if (targetPostSnap.exists) {
      res.status(409).json({ message: 'Target category already has a post with the same id' });
      return;
    }

    const sourcePostData = sourcePostSnap.data() || {};
    const sourceIndexData = sourceIndexSnap.exists ? sourceIndexSnap.data() || {} : {};
    const updates = sanitizePostUpdates(data);

    const targetPostData = {
      ...sourcePostData,
      ...updates,
      category: targetCategory,
    };

    await Promise.all([
      targetPostRef.set(targetPostData),
      targetIndexRef.set(buildIndexPayload(targetPostData, sourceIndexData)),
    ]);

    const migrationStats = await moveCommentsAndLikes({
      fromCategory: sourceCategory,
      toCategory: targetCategory,
      postId: normalizedPostId,
    });

    await Promise.all([
      sourcePostRef.delete(),
      sourceIndexRef.delete().catch(() => null),
    ]);

    res.json({
      message: 'Post category moved successfully',
      postId: normalizedPostId,
      fromCategory: sourceCategory,
      toCategory: targetCategory,
      ...migrationStats,
    });
  } catch (error) {
    console.error('[posts] 카테고리 이동 실패:', error);
    res.status(500).json({ message: 'Failed to move post category' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
