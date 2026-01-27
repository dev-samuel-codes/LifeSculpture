import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const filterDocRef = (collectionName) => doc(db, 'post_filters', collectionName);

export async function getPostFilters(collectionName) {
  if (!collectionName) return null;
  const snapshot = await getDoc(filterDocRef(collectionName));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

export async function savePostFilters({ collectionName, sections }) {
  if (!collectionName) {
    throw new Error('collectionName is required');
  }
  const payload = {
    sections: Array.isArray(sections) ? sections : [],
    updatedAt: serverTimestamp(),
  };
  await setDoc(filterDocRef(collectionName), payload, { merge: true });
  return payload;
}
