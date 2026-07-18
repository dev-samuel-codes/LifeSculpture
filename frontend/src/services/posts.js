import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as limitQuery,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

export {
  completePostMoveCleanupJob,
  movePostCategory,
} from './postCategoryMove';

const collectionRef = (category) => collection(db, category);
const docRef = (category, id) => doc(collectionRef(category), id);
const indexCollectionRef = (category) => collection(db, 'post_index', category, 'posts');
const indexDocRef = (category, id) => doc(indexCollectionRef(category), id);
const postLikeDocRef = (category, id, uid) =>
  doc(collection(docRef(category, id), 'likes'), uid);
const postDeletionJobDocRef = (jobId) => doc(db, 'post_deletion_jobs', jobId);
const FIRESTORE_BATCH_WRITE_LIMIT = 500;
const DELETE_STATIC_WRITE_COUNT = 3;

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
  includePrivate = false,
  order = 'desc',
  limit = 24,
  cursor = null,
}) {
  const constraints = [];
  if (!includePrivate) {
    constraints.push(where('isPublic', '==', true));
  }
  constraints.push(orderBy('createdAt', order === 'asc' ? 'asc' : 'desc'), limitQuery(limit));
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
  const indexPayload = buildIndexPayload(data);
  if (Object.keys(indexPayload).length === 0) {
    await updateDoc(docRef(category, id), data);
    return;
  }

  const batch = writeBatch(db);
  batch.update(docRef(category, id), data);
  batch.update(indexDocRef(category, id), indexPayload);
  await batch.commit();
}

export async function setPostVisibility({
  category,
  id,
  isPublic,
  content,
  pendingStorageCleanup,
}) {
  const batch = writeBatch(db);
  const postUpdates = content === undefined ? { isPublic } : { content, isPublic };
  if (pendingStorageCleanup !== undefined) {
    postUpdates.pendingStorageCleanup = pendingStorageCleanup;
  }
  batch.update(docRef(category, id), postUpdates);
  batch.update(indexDocRef(category, id), { isPublic });
  await batch.commit();
}

export async function setPostLike({ category, id, uid, like }) {
  if (!uid) throw new Error('uid is required');
  const batch = writeBatch(db);
  const delta = increment(like ? 1 : -1);

  if (like) {
    batch.set(postLikeDocRef(category, id, uid), { createdAt: serverTimestamp() });
  } else {
    batch.delete(postLikeDocRef(category, id, uid));
  }

  batch.update(docRef(category, id), { likeCount: delta });
  batch.update(indexDocRef(category, id), { likeCount: delta });
  await batch.commit();
}

export async function hasPostLike({ category, id, uid }) {
  if (!uid) return false;
  const snapshot = await getDoc(postLikeDocRef(category, id, uid));
  return snapshot.exists();
}

const getLegacyCommentDeleteRefs = async (postReference) => {
  const commentsSnapshot = await getDocs(collection(postReference, 'comments'));
  const likeSnapshots = await Promise.all(
    commentsSnapshot.docs.map((commentSnap) => getDocs(collection(commentSnap.ref, 'likes'))),
  );
  return commentsSnapshot.docs.flatMap((commentSnap, index) => [
    ...likeSnapshots[index].docs.map((likeSnap) => likeSnap.ref),
    commentSnap.ref,
  ]);
};

const getPostRelatedDeleteRefs = async (postReference) => {
  const [likesSnapshot, legacyCommentRefs] = await Promise.all([
    getDocs(collection(postReference, 'likes')),
    getLegacyCommentDeleteRefs(postReference),
  ]);
  return [
    ...likesSnapshot.docs.map((likeSnap) => likeSnap.ref),
    ...legacyCommentRefs,
  ];
};

export async function assertPostDeletionFitsBatch({ category, id }) {
  const relatedDeleteRefs = await getPostRelatedDeleteRefs(docRef(category, id));
  if (relatedDeleteRefs.length + DELETE_STATIC_WRITE_COUNT > FIRESTORE_BATCH_WRITE_LIMIT) {
    throw new Error('연관 데이터가 많은 게시물은 안전한 단일 배치로 삭제할 수 없습니다.');
  }
  return relatedDeleteRefs.length;
}

export async function deletePost({ category, id, storageCleanup = {} }) {
  const postReference = docRef(category, id);
  const relatedDeleteRefs = await getPostRelatedDeleteRefs(postReference);
  if (relatedDeleteRefs.length + DELETE_STATIC_WRITE_COUNT > FIRESTORE_BATCH_WRITE_LIMIT) {
    throw new Error('연관 데이터가 많은 게시물은 안전한 단일 배치로 삭제할 수 없습니다.');
  }

  const jobId = `${category}--${id}`;
  const urls = Array.isArray(storageCleanup.urls) ? [...new Set(storageCleanup.urls)] : [];
  const pathPrefixes = Array.isArray(storageCleanup.pathPrefixes)
    ? [...new Set(storageCleanup.pathPrefixes)]
    : [];
  const batch = writeBatch(db);
  batch.set(postDeletionJobDocRef(jobId), {
    category,
    postId: id,
    urls,
    pathPrefixes,
    createdAt: serverTimestamp(),
  });
  relatedDeleteRefs.forEach((reference) => batch.delete(reference));
  batch.delete(postReference);
  batch.delete(indexDocRef(category, id));
  await batch.commit();
  return { jobId };
}

export async function listPostDeletionJobs() {
  const snapshot = await getDocs(collection(db, 'post_deletion_jobs'));
  return snapshot.docs.map((jobSnap) => ({
    id: jobSnap.id,
    ...jobSnap.data(),
  }));
}

export async function completePostDeletionJob({ jobId }) {
  const batch = writeBatch(db);
  batch.delete(postDeletionJobDocRef(jobId));
  await batch.commit();
}

export async function queueStorageCleanup({
  jobId,
  category,
  id,
  storageCleanup = {},
}) {
  const urls = Array.isArray(storageCleanup.urls) ? [...new Set(storageCleanup.urls)] : [];
  const pathPrefixes = Array.isArray(storageCleanup.pathPrefixes)
    ? [...new Set(storageCleanup.pathPrefixes)]
    : [];
  const batch = writeBatch(db);
  batch.set(postDeletionJobDocRef(jobId), {
    category,
    postId: id,
    urls,
    pathPrefixes,
    reason: 'orphan-storage-cleanup',
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
