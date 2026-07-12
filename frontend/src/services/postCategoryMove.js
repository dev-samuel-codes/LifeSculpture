import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const POST_CATEGORIES = new Set(['blog', 'study']);
const BATCH_WRITE_LIMIT = 450;
const INDEX_FIELDS = ['title', 'tags', 'createdAt', 'viewCount', 'likeCount', 'isPublic'];
const DEFAULT_DEV_BACKEND_URL = 'http://localhost:5000';
const configuredBackendBaseUrl = (process.env.REACT_APP_BACKEND_URL || '').trim().replace(/\/$/, '');
const backendBaseUrl = configuredBackendBaseUrl ||
  (process.env.NODE_ENV === 'development' ? DEFAULT_DEV_BACKEND_URL : '');

const collectionRef = (category) => collection(db, category);
const docRef = (category, id) => doc(collectionRef(category), id);
const indexCollectionRef = (category) => collection(db, 'post_index', category, 'posts');
const indexDocRef = (category, id) => doc(indexCollectionRef(category), id);

const buildMovedIndexPayload = (postData = {}, sourceIndexData = {}) => {
  const payload = {};
  INDEX_FIELDS.forEach((field) => {
    if (postData[field] !== undefined) {
      payload[field] = postData[field];
      return;
    }
    if (sourceIndexData[field] !== undefined) payload[field] = sourceIndexData[field];
  });
  if (payload.viewCount === undefined) payload.viewCount = 0;
  if (payload.likeCount === undefined) payload.likeCount = 0;
  if (payload.tags === undefined) payload.tags = [];
  if (payload.isPublic === undefined) payload.isPublic = true;
  return payload;
};

const sanitizePostUpdates = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const allowedKeys = new Set([
    'title',
    'content',
    'tags',
    'isPublic',
    'contentStyleSettings',
    'contentTableSettings',
    'pendingStorageCleanup',
  ]);
  const updates = {};
  Object.entries(input).forEach(([key, value]) => {
    if (allowedKeys.has(key) && value !== undefined) updates[key] = value;
  });
  return updates;
};

const isValidPostCategory = (category) =>
  typeof category === 'string' && POST_CATEGORIES.has(category.trim());

const createBatchWriter = () => {
  let batch = writeBatch(db);
  let operationCount = 0;

  const flush = async () => {
    if (operationCount === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    operationCount = 0;
  };

  const set = async (reference, data) => {
    batch.set(reference, data);
    operationCount += 1;
    if (operationCount >= BATCH_WRITE_LIMIT) await flush();
  };

  const remove = async (reference) => {
    batch.delete(reference);
    operationCount += 1;
    if (operationCount >= BATCH_WRITE_LIMIT) await flush();
  };

  return { set, delete: remove, flush };
};

const movePostLikesClientSide = async ({ sourcePostRef, targetPostRef }) => {
  const sourceLikesRef = collection(sourcePostRef, 'likes');
  const targetLikesRef = collection(targetPostRef, 'likes');
  const likesSnapshot = await getDocs(sourceLikesRef);
  if (likesSnapshot.empty) return 0;

  const copyWriter = createBatchWriter();
  for (const likeSnap of likesSnapshot.docs) {
    await copyWriter.set(doc(targetLikesRef, likeSnap.id), likeSnap.data());
  }
  await copyWriter.flush();

  const deleteWriter = createBatchWriter();
  for (const likeSnap of likesSnapshot.docs) {
    await deleteWriter.delete(doc(sourceLikesRef, likeSnap.id));
  }
  await deleteWriter.flush();
  return likesSnapshot.size;
};

const moveCommentsAndLikesClientSide = async ({ fromCategory, toCategory, id }) => {
  const sourcePostRef = docRef(fromCategory, id);
  const targetPostRef = docRef(toCategory, id);
  const sourceCommentsRef = collection(sourcePostRef, 'comments');
  const targetCommentsRef = collection(targetPostRef, 'comments');
  const commentsSnapshot = await getDocs(sourceCommentsRef);

  if (commentsSnapshot.empty) return { commentCount: 0, likeCount: 0 };

  const copiedLikes = [];
  const copyWriter = createBatchWriter();
  let likeCount = 0;
  for (const commentSnap of commentsSnapshot.docs) {
    const sourceCommentRef = doc(sourceCommentsRef, commentSnap.id);
    const targetCommentRef = doc(targetCommentsRef, commentSnap.id);
    await copyWriter.set(targetCommentRef, commentSnap.data());

    const likesSnapshot = await getDocs(collection(sourceCommentRef, 'likes'));
    for (const likeSnap of likesSnapshot.docs) {
      await copyWriter.set(
        doc(collection(targetCommentRef, 'likes'), likeSnap.id),
        likeSnap.data(),
      );
      copiedLikes.push({ commentId: commentSnap.id, likeId: likeSnap.id });
      likeCount += 1;
    }
  }
  await copyWriter.flush();

  const deleteWriter = createBatchWriter();
  for (const { commentId, likeId } of copiedLikes) {
    await deleteWriter.delete(
      doc(collection(doc(sourceCommentsRef, commentId), 'likes'), likeId),
    );
  }
  for (const commentSnap of commentsSnapshot.docs) {
    await deleteWriter.delete(doc(sourceCommentsRef, commentSnap.id));
  }
  await deleteWriter.flush();
  return { commentCount: commentsSnapshot.size, likeCount };
};

const movePostCategoryClientSide = async ({ fromCategory, toCategory, id, data = {} }) => {
  const sourceCategory = typeof fromCategory === 'string' ? fromCategory.trim() : '';
  const targetCategory = typeof toCategory === 'string' ? toCategory.trim() : '';
  const postId = typeof id === 'string' ? id.trim() : '';

  if (!postId) throw new Error('postId가 필요합니다.');
  if (!isValidPostCategory(sourceCategory) || !isValidPostCategory(targetCategory)) {
    throw new Error('카테고리가 올바르지 않습니다.');
  }
  if (sourceCategory === targetCategory) {
    throw new Error('같은 카테고리로는 이동할 수 없습니다.');
  }

  const sourcePostRef = docRef(sourceCategory, postId);
  const sourceIndexRef = indexDocRef(sourceCategory, postId);
  const targetPostRef = docRef(targetCategory, postId);
  const targetIndexRef = indexDocRef(targetCategory, postId);
  const [sourcePostSnap, sourceIndexSnap, targetPostSnap] = await Promise.all([
    getDoc(sourcePostRef),
    getDoc(sourceIndexRef),
    getDoc(targetPostRef),
  ]);

  if (!sourcePostSnap.exists()) {
    throw new Error('원본 카테고리에서 게시글을 찾을 수 없습니다.');
  }
  if (targetPostSnap.exists()) {
    throw new Error('대상 카테고리에 같은 게시글이 이미 있습니다.');
  }

  const sourcePostData = sourcePostSnap.data() || {};
  const sourceIndexData = sourceIndexSnap.exists() ? sourceIndexSnap.data() || {} : {};
  const targetPostData = {
    ...sourcePostData,
    ...sanitizePostUpdates(data),
    category: targetCategory,
  };

  const copyWriter = createBatchWriter();
  await copyWriter.set(targetPostRef, targetPostData);
  await copyWriter.set(
    targetIndexRef,
    buildMovedIndexPayload(targetPostData, sourceIndexData),
  );
  await copyWriter.flush();
  const postLikeCount = await movePostLikesClientSide({
    sourcePostRef,
    targetPostRef,
  });
  const migrationStats = await moveCommentsAndLikesClientSide({
    fromCategory: sourceCategory,
    toCategory: targetCategory,
    id: postId,
  });

  const deleteWriter = createBatchWriter();
  await deleteWriter.delete(sourcePostRef);
  await deleteWriter.delete(sourceIndexRef);
  await deleteWriter.flush();
  return {
    message: 'Post category moved successfully',
    postId,
    fromCategory: sourceCategory,
    toCategory: targetCategory,
    postLikeCount,
    ...migrationStats,
  };
};

export async function movePostCategory({ fromCategory, toCategory, id, data = {} }) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  if (!backendBaseUrl) {
    return movePostCategoryClientSide({ fromCategory, toCategory, id, data });
  }

  const idToken = await user.getIdToken();
  let response;
  try {
    response = await fetch(`${backendBaseUrl}/posts/move-category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ postId: id, fromCategory, toCategory, data }),
    });
  } catch (error) {
    return movePostCategoryClientSide({ fromCategory, toCategory, id, data });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.message || '카테고리 이동에 실패했습니다.');
  }
  return payload;
}
