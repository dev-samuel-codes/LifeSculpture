const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeFirebaseAdmin, initializeFirestore } = require('./firebase-admin');

test('returns the initialized Firebase Admin client for auth and field values', () => {
  // Given: an uninitialized Firebase Admin client with auth and Firestore APIs.
  const adminClient = {
    apps: [],
    auth: () => ({ verifyIdToken: () => undefined }),
    firestore: Object.assign(() => ({ name: 'firestore' }), {
      FieldValue: { serverTimestamp: () => 'timestamp' },
    }),
    initializeApp: () => {
      adminClient.apps.push({ name: 'default' });
    },
  };

  // When: the server initializes its shared administrator client.
  const result = initializeFirebaseAdmin(adminClient);

  // Then: authentication and field value APIs remain available on that client.
  assert.equal(result, adminClient);
  assert.equal(typeof result.auth, 'function');
  assert.equal(result.firestore.FieldValue.serverTimestamp(), 'timestamp');
});

test('initializes Firebase Admin with application default credentials', () => {
  // Given: Firebase Admin has no initialized application.
  const firestore = { name: 'firestore' };
  const adminClient = {
    apps: [],
    firestore: () => firestore,
    initializeApp: () => {
      adminClient.apps.push({ name: 'default' });
    },
  };

  // When: the server requests its Firestore administrator client.
  const result = initializeFirestore(adminClient);

  // Then: default credential discovery initializes one app and returns Firestore.
  assert.equal(adminClient.apps.length, 1);
  assert.equal(result, firestore);
});

test('reuses an existing Firebase Admin application', () => {
  // Given: the runtime already initialized Firebase Admin.
  const firestore = { name: 'firestore' };
  let initializeCalls = 0;
  const adminClient = {
    apps: [{ name: 'default' }],
    firestore: () => firestore,
    initializeApp: () => {
      initializeCalls += 1;
    },
  };

  // When: another module requests the Firestore administrator client.
  const result = initializeFirestore(adminClient);

  // Then: initialization is not repeated and the existing client is returned.
  assert.equal(initializeCalls, 0);
  assert.equal(result, firestore);
});
