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
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const collectionRef = (category) => collection(db, category);
const docRef = (category, id) => doc(collectionRef(category), id);
const indexCollectionRef = (category) => collection(db, 'post_index', category, 'posts');
const indexDocRef = (category, id) => doc(indexCollectionRef(category), id);

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
