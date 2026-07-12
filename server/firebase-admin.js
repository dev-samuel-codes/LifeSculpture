const admin = require('firebase-admin');

function initializeFirebaseAdmin(adminClient = admin) {
  if (adminClient.apps.length === 0) {
    adminClient.initializeApp();
  }
  return adminClient;
}

function initializeFirestore(adminClient = admin) {
  return initializeFirebaseAdmin(adminClient).firestore();
}

module.exports = { initializeFirebaseAdmin, initializeFirestore };
