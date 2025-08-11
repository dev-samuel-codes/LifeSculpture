import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBKlfN8KIB09mW-YuDLlABN_rO7dkwFg-4",
  authDomain: "lifesculpture-220b3.firebaseapp.com",
  projectId: "lifesculpture-220b3",
  storageBucket: "lifesculpture-220b3.firebasestorage.app",
  messagingSenderId: "292030527657",
  appId: "1:292030527657:web:34d1a048b0dcca0e7b91b8",
  measurementId: "G-WZBEMRTYSX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

export { db };
