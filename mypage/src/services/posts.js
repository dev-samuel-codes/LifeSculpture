import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const collectionRef = (category) => collection(db, category);
const docRef = (category, id) => doc(collectionRef(category), id);

const toPlainPost = (snap) => {
  if (!snap?.exists?.()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
  };
};

export async function listPosts({ category, order = 'desc' }) {
  const constraints = [orderBy('createdAt', order === 'asc' ? 'asc' : 'desc')];
  const snapshot = await getDocs(query(collectionRef(category), ...constraints));
  return snapshot.docs.map((docSnap) => toPlainPost(docSnap));
}

export async function getPost({ category, id }) {
  const snapshot = await getDoc(docRef(category, id));
  return toPlainPost(snapshot);
}

export async function createPost({ category, id, data }) {
  if (id) {
    await setDoc(docRef(category, id), {
      ...data,
      createdAt: data.createdAt ?? serverTimestamp(),
      updatedAt: data.updatedAt ?? serverTimestamp(),
    });
    const snapshot = await getDoc(docRef(category, id));
    return toPlainPost(snapshot);
  }

  const newDocRef = doc(collectionRef(category));
  await setDoc(newDocRef, {
    ...data,
    createdAt: data.createdAt ?? serverTimestamp(),
    updatedAt: data.updatedAt ?? serverTimestamp(),
  });
  const snapshot = await getDoc(newDocRef);
  return toPlainPost(snapshot);
}

export async function updatePost({ category, id, data }) {
  await updateDoc(docRef(category, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function updatePostFields({ category, id, data }) {
  await updateDoc(docRef(category, id), data);
}

export async function incrementPostView({ category, id }) {
  await updateDoc(docRef(category, id), {
    viewCount: increment(1),
  });
}

export async function setPostVisibility({ category, id, isPublic }) {
  await updateDoc(docRef(category, id), { isPublic });
}

export async function setPostLike({ category, id, uid, like }) {
  if (!uid) throw new Error('uid is required');
  await updateDoc(docRef(category, id), {
    likeCount: increment(like ? 1 : -1),
    likedBy: like ? arrayUnion(uid) : arrayRemove(uid),
  });
}

export async function deletePost({ category, id }) {
  await deleteDoc(docRef(category, id));
}
