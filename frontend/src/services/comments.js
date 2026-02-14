import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  increment,
  limit as limitQuery,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

export const DEFAULT_PAGE_SIZE = 10;

const commentsCollection = (category, postId) =>
  collection(db, `${category}/${postId}/comments`);

const commentDoc = (category, postId, commentId) =>
  doc(commentsCollection(category, postId), commentId);

const likesCollection = (category, postId, commentId) =>
  collection(commentDoc(category, postId, commentId), 'likes');

const likeDoc = (category, postId, commentId, uid) =>
  doc(likesCollection(category, postId, commentId), uid);

const toPlainComment = (snap) => {
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
};

export async function fetchCommentsPage({
  category,
  postId,
  parentId = null,
  pageSize = DEFAULT_PAGE_SIZE,
  order = 'desc',
  cursor = null,
}) {
  const baseRef = commentsCollection(category, postId);
  const constraints = [
    where('parentId', '==', parentId),
    order === 'asc' ? orderBy('createdAt', 'asc') : orderBy('createdAt', 'desc'),
    limitQuery(pageSize),
  ];

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const snap = await getDocs(query(baseRef, ...constraints));
  const comments = snap.docs.map((docSnap) => toPlainComment(docSnap));
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return {
    comments,
    cursor: lastDoc,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function createComment({
  category,
  postId,
  parentId = null,
  content,
  authorId,
  authorName,
  authorPhoto = null,
}) {
  const ref = doc(commentsCollection(category, postId));
  const timestamp = serverTimestamp();

  await setDoc(ref, {
    authorId,
    authorName,
    authorPhoto: authorPhoto ?? null,
    content,
    parentId: parentId ?? null,
    likeCount: 0,
    replyCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const snap = await getDoc(ref);
  return toPlainComment(snap);
}

export async function fetchLikeCount({ category, postId, commentId }) {
  const agg = await getCountFromServer(
    likesCollection(category, postId, commentId),
  );
  return agg.data().count ?? 0;
}

export async function syncCommentLikeCount({
  category,
  postId,
  commentId,
  likeCount,
}) {
  await updateDoc(commentDoc(category, postId, commentId), {
    likeCount,
  });
}

export async function hasUserLiked({
  category,
  postId,
  commentId,
  uid,
}) {
  if (!uid) return false;
  const snap = await getDoc(likeDoc(category, postId, commentId, uid));
  return snap.exists();
}

export async function likeComment({ category, postId, commentId, uid }) {
  await Promise.all([
    setDoc(likeDoc(category, postId, commentId, uid), {
      createdAt: serverTimestamp(),
    }),
    updateDoc(commentDoc(category, postId, commentId), {
      likeCount: increment(1),
    }),
  ]);
}

export async function unlikeComment({ category, postId, commentId, uid }) {
  await Promise.all([
    deleteDoc(likeDoc(category, postId, commentId, uid)),
    updateDoc(commentDoc(category, postId, commentId), {
      likeCount: increment(-1),
    }),
  ]);
}

export async function deleteCommentTree({ category, postId, commentId }) {
  const repliesSnap = await getDocs(
    query(
      commentsCollection(category, postId),
      where('parentId', '==', commentId),
    ),
  );
  const replyIds = repliesSnap.docs.map((docSnap) => docSnap.id);

  await Promise.all(
    replyIds.map((id) => deleteDoc(commentDoc(category, postId, id))),
  );

  await deleteDoc(commentDoc(category, postId, commentId));
}
