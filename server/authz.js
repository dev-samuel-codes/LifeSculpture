const resolveUserRole = async (firestore, uid) => {
  const snapshot = await firestore.collection('users').doc(uid).get();
  if (!snapshot.exists) {
    return 'user';
  }

  return snapshot.data()?.role === 'admin' ? 'admin' : 'user';
};

module.exports = { resolveUserRole };
