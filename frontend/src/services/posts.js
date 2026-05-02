import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as limitQuery,
  orderBy,
  query,
  startAfter,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const POST_CATEGORIES = new Set(['blog', 'study']);
const BATCH_WRITE_LIMIT = 450;
const INDEX_FIELDS = ['title', 'tags', 'createdAt', 'viewCount', 'likeCount', 'isPublic'];
const DEFAULT_DEV_BACKEND_URL = 'http://localhost:5000';

const collectionRef = (category) => collection(db, category);
const docRef = (category, id) => doc(collectionRef(category), id);
const indexCollectionRef = (category) => collection(db, 'post_index', category, 'posts');
const indexDocRef = (category, id) => doc(indexCollectionRef(category), id);
const configuredBackendBaseUrl = (process.env.REACT_APP_BACKEND_URL || '').trim().replace(/\/$/, '');
const backendBaseUrl = configuredBackendBaseUrl ||
  (process.env.NODE_ENV === 'development' ? DEFAULT_DEV_BACKEND_URL : '');

const buildIndexPayload = (data = {}) => {
  const payload = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.tags !== undefined) payload.tags = data.tags;
  if (data.createdAt !== undefined) payload.createdAt = data.createdAt;
  if (data.viewCount !== undefined) payload.viewCount = data.viewCount;
  if (data.likeCount !== undefined) payload.likeCount = data.likeCount;
  if (data.isPublic !== undefined) payload.isPublic = data.isPublic;
  return payload;
};

const buildMovedIndexPayload = (postData = {}, sourceIndexData = {}) => {
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
  ]);
  const updates = {};

  Object.entries(input).forEach(([key, value]) => {
    if (allowedKeys.has(key) && value !== undefined) {
      updates[key] = value;
    }
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

  const set = async (ref, data) => {
    batch.set(ref, data);
    operationCount += 1;
    if (operationCount >= BATCH_WRITE_LIMIT) {
      await flush();
    }
  };

  const remove = async (ref) => {
    batch.delete(ref);
    operationCount += 1;
    if (operationCount >= BATCH_WRITE_LIMIT) {
      await flush();
    }
  };

  return { set, delete: remove, flush };
};

const moveCommentsAndLikesClientSide = async ({ fromCategory, toCategory, id }) => {
  const sourcePostRef = docRef(fromCategory, id);
  const targetPostRef = docRef(toCategory, id);
  const sourceCommentsRef = collection(sourcePostRef, 'comments');
  const targetCommentsRef = collection(targetPostRef, 'comments');
  const commentsSnapshot = await getDocs(sourceCommentsRef);

  if (commentsSnapshot.empty) {
    return { commentCount: 0, likeCount: 0 };
  }

  const copiedLikes = [];
  const copyWriter = createBatchWriter();
  let likeCount = 0;

  for (const commentSnap of commentsSnapshot.docs) {
    const sourceCommentRef = doc(sourceCommentsRef, commentSnap.id);
    const targetCommentRef = doc(targetCommentsRef, commentSnap.id);
    await copyWriter.set(targetCommentRef, commentSnap.data());

    const likesSnapshot = await getDocs(collection(sourceCommentRef, 'likes'));
    for (const likeSnap of likesSnapshot.docs) {
      await copyWriter.set(doc(collection(targetCommentRef, 'likes'), likeSnap.id), likeSnap.data());
      copiedLikes.push({
        commentId: commentSnap.id,
        likeId: likeSnap.id,
      });
      likeCount += 1;
    }
  }
  await copyWriter.flush();

  const deleteWriter = createBatchWriter();
  for (const { commentId, likeId } of copiedLikes) {
    await deleteWriter.delete(doc(collection(doc(sourceCommentsRef, commentId), 'likes'), likeId));
  }
  for (const commentSnap of commentsSnapshot.docs) {
    await deleteWriter.delete(doc(sourceCommentsRef, commentSnap.id));
  }
  await deleteWriter.flush();

  return {
    commentCount: commentsSnapshot.size,
    likeCount,
  };
};

const movePostCategoryClientSide = async ({
  fromCategory,
  toCategory,
  id,
  data = {},
}) => {
  const sourceCategory = typeof fromCategory === 'string' ? fromCategory.trim() : '';
  const targetCategory = typeof toCategory === 'string' ? toCategory.trim() : '';
  const postId = typeof id === 'string' ? id.trim() : '';

  if (!postId) {
    throw new Error('postId가 필요합니다.');
  }
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
  await copyWriter.set(targetIndexRef, buildMovedIndexPayload(targetPostData, sourceIndexData));
  await copyWriter.flush();

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
    ...migrationStats,
  };
};

const safeUpdateIndex = async (category, id, data) => {
  if (!data || Object.keys(data).length === 0) return;
  try {
    await updateDoc(indexDocRef(category, id), data);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[posts] 인덱스 문서 업데이트 실패:', error);
    }
  }
};

const toPlainPost = (snap) => {
  if (!snap?.exists?.()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
  };
};

export async function listPostsPage({
  category,
  order = 'desc',
  limit = 24,
  cursor = null,
}) {
  const constraints = [orderBy('createdAt', order === 'asc' ? 'asc' : 'desc'), limitQuery(limit)];
  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const snapshot = await getDocs(query(indexCollectionRef(category), ...constraints));
  return {
    posts: snapshot.docs.map((docSnap) => toPlainPost(docSnap)),
    cursor: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === limit,
  };
}

export async function getPost({ category, id }) {
  const snapshot = await getDoc(docRef(category, id));
  return toPlainPost(snapshot);
}

export async function updatePostFields({ category, id, data }) {
  await updateDoc(docRef(category, id), data);
  const indexPayload = buildIndexPayload(data);
  await safeUpdateIndex(category, id, indexPayload);
}

export async function movePostCategory({
  fromCategory,
  toCategory,
  id,
  data = {},
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  if (!backendBaseUrl) {
    return movePostCategoryClientSide({
      fromCategory,
      toCategory,
      id,
      data,
    });
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
      body: JSON.stringify({
        postId: id,
        fromCategory,
        toCategory,
        data,
      }),
    });
  } catch (error) {
    return movePostCategoryClientSide({
      fromCategory,
      toCategory,
      id,
      data,
    });
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

export async function incrementPostView({ category, id }) {
  await updateDoc(docRef(category, id), {
    viewCount: increment(1),
  });
  await safeUpdateIndex(category, id, { viewCount: increment(1) });
}

export async function setPostVisibility({ category, id, isPublic }) {
  await updateDoc(docRef(category, id), { isPublic });
  await safeUpdateIndex(category, id, { isPublic });
}

export async function setPostLike({ category, id, uid, like }) {
  if (!uid) throw new Error('uid is required');
  await updateDoc(docRef(category, id), {
    likeCount: increment(like ? 1 : -1),
    likedBy: like ? arrayUnion(uid) : arrayRemove(uid),
  });
  await safeUpdateIndex(category, id, { likeCount: increment(like ? 1 : -1) });
}

export async function deletePost({ category, id }) {
  await deleteDoc(docRef(category, id));
  try {
    await deleteDoc(indexDocRef(category, id));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[posts] 인덱스 문서 삭제 실패:', error);
    }
  }
}
