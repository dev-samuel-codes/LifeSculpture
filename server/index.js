require('dotenv').config();

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const { resolveUserRole } = require('./authz');
const { initializeFirebaseAdmin } = require('./firebase-admin');

const REQUIRED_ENV_KEYS = [
  'JWT_SECRET_KEY',
  'GOOGLE_CLIENT_ID_BACKEND',
];

const missingEnv = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  throw new Error(`[server] 필수 환경변수가 누락되었습니다: ${missingEnv.join(', ')}`);
}

const admin = initializeFirebaseAdmin();
const dbAdmin = admin.firestore();

const app = express();
const port = Number(process.env.PORT || 5000);
const SECRET_KEY = process.env.JWT_SECRET_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID_BACKEND;
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
const FIRESTORE_BATCH_WRITE_LIMIT = 500;
const MOVE_STATIC_WRITE_COUNT = 4;
const INDEX_FIELDS = ['title', 'tags', 'createdAt', 'viewCount', 'likeCount', 'isPublic'];

const sanitizePostUpdates = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const allowedKeys = new Set([
    'title',
    'content',
    'tags',
    'isPublic',
    'contentStyleSettings',
    'contentTableSettings',
    'pendingStorageCleanup',
    'storagePathPrefixes',
  ]);
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

const requireAdmin = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ message: 'Authorization header is required' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const role = await resolveUserRole(dbAdmin, decoded.uid);

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
    const role = await resolveUserRole(dbAdmin, uid);

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
    const role = await resolveUserRole(dbAdmin, uid);

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

const uniqueStrings = (value) => Array.isArray(value)
  ? [...new Set(value.filter((item) => typeof item === 'string' && item))]
  : [];

const getLegacyCommentDeleteRefs = async (postRef) => {
  const commentsSnapshot = await postRef.collection('comments').get();
  const likeSnapshots = await Promise.all(
    commentsSnapshot.docs.map((commentDoc) => commentDoc.ref.collection('likes').get()),
  );
  return commentsSnapshot.docs.flatMap((commentDoc, index) => [
    ...likeSnapshots[index].docs.map((likeDoc) => likeDoc.ref),
    commentDoc.ref,
  ]);
};

app.post('/posts/move-category', requireAdmin, async (req, res) => {
  const {
    postId,
    fromCategory,
    toCategory,
    data,
    preparedStorageCleanup,
  } = req.body || {};
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
  const jobId = `${sourceCategory}--${targetCategory}--${normalizedPostId}`;
  const jobRef = dbAdmin.collection('post_move_jobs').doc(jobId);

  try {
    const sourceLikesRef = sourcePostRef.collection('likes');
    const targetLikesRef = targetPostRef.collection('likes');
    let lockResult = null;
    await dbAdmin.runTransaction(async (transaction) => {
      const [sourcePostSnap, sourceIndexSnap, targetPostSnap, targetIndexSnap] =
        await Promise.all([
          transaction.get(sourcePostRef),
          transaction.get(sourceIndexRef),
          transaction.get(targetPostRef),
          transaction.get(targetIndexRef),
        ]);
      if (!sourcePostSnap.exists || !sourceIndexSnap.exists) {
        const error = new Error('Post or index not found in source category');
        error.statusCode = 404;
        throw error;
      }
      if (targetPostSnap.exists || targetIndexSnap.exists) {
        const error = new Error('Target category already has a post with the same id');
        error.statusCode = 409;
        throw error;
      }

      const sourcePostData = sourcePostSnap.data() || {};
      const sourceIndexData = sourceIndexSnap.data() || {};
      const originalIsPublic = sourcePostData.isPublic !== false;
      transaction.update(sourcePostRef, {
        isPublic: false,
        categoryMoveJobId: jobId,
      });
      transaction.update(sourceIndexRef, { isPublic: false });
      transaction.set(jobRef, {
        sourceCategory,
        targetCategory,
        postId: normalizedPostId,
        originalIsPublic,
        preparedImageUrls: uniqueStrings(preparedStorageCleanup?.urls),
        preparedPathPrefixes: uniqueStrings(preparedStorageCleanup?.pathPrefixes),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      lockResult = { sourcePostData, sourceIndexData, originalIsPublic };
    });

    const [likesSnapshot, legacyCommentRefs] = await Promise.all([
      sourceLikesRef.get(),
      getLegacyCommentDeleteRefs(sourcePostRef),
    ]);
    const writeCount = MOVE_STATIC_WRITE_COUNT +
      (likesSnapshot.size * 2) +
      legacyCommentRefs.length;
    if (writeCount > FIRESTORE_BATCH_WRITE_LIMIT) {
      await dbAdmin.runTransaction(async (transaction) => {
        const [sourcePostSnap, sourceIndexSnap, targetPostSnap, targetIndexSnap] =
          await Promise.all([
            transaction.get(sourcePostRef),
            transaction.get(sourceIndexRef),
            transaction.get(targetPostRef),
            transaction.get(targetIndexRef),
          ]);
        if (!sourcePostSnap.exists || !sourceIndexSnap.exists ||
            targetPostSnap.exists || targetIndexSnap.exists) {
          throw new Error('Failed to restore category move lock');
        }
        transaction.update(sourcePostRef, {
          isPublic: lockResult.originalIsPublic,
          categoryMoveJobId: admin.firestore.FieldValue.delete(),
        });
        transaction.update(sourceIndexRef, { isPublic: lockResult.originalIsPublic });
        transaction.delete(jobRef);
      });
      res.status(409).json({
        message: `Move exceeds the ${FIRESTORE_BATCH_WRITE_LIMIT}-write atomic limit`,
      });
      return;
    }

    const updates = sanitizePostUpdates(data);
    const { categoryMoveJobId, ...unlockedSourcePostData } = lockResult.sourcePostData;
    const targetPostData = {
      ...unlockedSourcePostData,
      ...updates,
      isPublic: updates.isPublic === undefined ? lockResult.originalIsPublic : updates.isPublic,
      category: targetCategory,
    };

    await dbAdmin.runTransaction(async (transaction) => {
      const [sourcePostSnap, sourceIndexSnap, targetPostSnap, targetIndexSnap, jobSnap] =
        await Promise.all([
          transaction.get(sourcePostRef),
          transaction.get(sourceIndexRef),
          transaction.get(targetPostRef),
          transaction.get(targetIndexRef),
          transaction.get(jobRef),
        ]);
      if (!sourcePostSnap.exists || !sourceIndexSnap.exists || !jobSnap.exists ||
          sourcePostSnap.data()?.categoryMoveJobId !== jobId) {
        throw new Error('Category move lock is no longer valid');
      }
      if (targetPostSnap.exists || targetIndexSnap.exists) {
        const error = new Error('Target category was created while moving the post');
        error.statusCode = 409;
        throw error;
      }

      transaction.set(targetPostRef, targetPostData);
      transaction.set(
        targetIndexRef,
        buildIndexPayload(targetPostData, lockResult.sourceIndexData),
      );
      likesSnapshot.docs.forEach((likeDoc) => {
        transaction.set(targetLikesRef.doc(likeDoc.id), likeDoc.data());
        transaction.delete(likeDoc.ref);
      });
      legacyCommentRefs.forEach((reference) => transaction.delete(reference));
      transaction.delete(sourcePostRef);
      transaction.delete(sourceIndexRef);
    });

    await jobRef.delete();

    res.json({
      message: 'Post category moved successfully',
      postId: normalizedPostId,
      fromCategory: sourceCategory,
      toCategory: targetCategory,
      postLikeCount: likesSnapshot.size,
    });
  } catch (error) {
    console.error('[posts] 카테고리 이동 실패:', error);
    try {
      await dbAdmin.runTransaction(async (transaction) => {
        const [sourcePostSnap, sourceIndexSnap, targetPostSnap, targetIndexSnap, jobSnap] =
          await Promise.all([
            transaction.get(sourcePostRef),
            transaction.get(sourceIndexRef),
            transaction.get(targetPostRef),
            transaction.get(targetIndexRef),
            transaction.get(jobRef),
          ]);
        if (!jobSnap.exists || !sourcePostSnap.exists || !sourceIndexSnap.exists ||
            sourcePostSnap.data()?.categoryMoveJobId !== jobId) {
          return;
        }
        transaction.update(sourcePostRef, {
          isPublic: jobSnap.data()?.originalIsPublic === true,
          categoryMoveJobId: admin.firestore.FieldValue.delete(),
        });
        transaction.update(sourceIndexRef, {
          isPublic: jobSnap.data()?.originalIsPublic === true,
        });
        transaction.delete(jobRef);
      });
    } catch (restoreError) {
      console.error('[posts] 카테고리 이동 잠금 복구 실패:', restoreError);
    }
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Failed to move post category',
    });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
