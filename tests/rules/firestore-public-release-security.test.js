const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');
const {
  assertFails,
  assertSucceeds,
  createRulesTestEnv,
} = require('./setup');

let testEnv;

const timestamp = () => firebase.firestore.FieldValue.serverTimestamp();
const increment = (value) => firebase.firestore.FieldValue.increment(value);
const arrayUnion = (value) => firebase.firestore.FieldValue.arrayUnion(value);

beforeAll(async () => {
  testEnv = await createRulesTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const publicPost = {
      title: 'Public Post',
      isPublic: true,
      likeCount: 0,
    };
    const privatePost = {
      title: 'Private Post',
      isPublic: false,
      likeCount: 0,
      likedBy: [],
    };

    await Promise.all([
      db.doc('users/admin-uid').set({ role: 'admin' }),
      db.doc('users/user-a').set({ role: 'user' }),
      db.doc('blog/post-a').set(publicPost),
      db.doc('blog/private-post').set(privatePost),
      db.doc('study/post-a').set(publicPost),
      db.doc('study/private-post').set(privatePost),
      db.doc('post_index/blog/posts/post-a').set(publicPost),
      db.doc('post_index/blog/posts/private-post').set(privatePost),
      db.doc('blog/post-a/comments/comment-a').set({
        authorId: 'user-a',
        authorName: null,
        authorPhoto: null,
        content: 'hello',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ]);
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

test('comment content is accepted at 2000 characters and denied at 2001', async () => {
  // Given: a signed-in user and a public post.
  const db = testEnv.authenticatedContext('user-a').firestore();

  // When: the user writes comments at and above the documented limit.
  const atLimit = db.doc('blog/post-a/comments/at-limit').set({
    authorId: 'user-a',
    authorName: null,
    authorPhoto: null,
    content: 'a'.repeat(2000),
    parentId: null,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  });
  const overLimit = db.doc('blog/post-a/comments/over-limit').set({
    authorId: 'user-a',
    authorName: null,
    authorPhoto: null,
    content: 'a'.repeat(2001),
    parentId: null,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  });

  // Then: only the bounded comment is accepted.
  await assertSucceeds(atLimit);
  await assertFails(overLimit);
});

test('comment owner cannot update content beyond 2000 characters', async () => {
  // Given: an existing comment owned by the signed-in user.
  const db = testEnv.authenticatedContext('user-a').firestore();

  // When: the owner replaces its content with an oversized value.
  const oversizedUpdate = db.doc('blog/post-a/comments/comment-a').update({
    content: 'a'.repeat(2001),
    updatedAt: timestamp(),
  });

  // Then: the update is denied at the Rules boundary.
  await assertFails(oversizedUpdate);
});

test('normal user cannot mutate likes on private posts or indexes', async () => {
  // Given: private blog, study, and index documents with legacy like fields.
  const db = testEnv.authenticatedContext('user-a').firestore();
  const likeChange = {
    likeCount: increment(1),
    likedBy: arrayUnion('user-a'),
  };

  // When: the user attempts the legacy update against each private object.
  const privateBlogLike = db.doc('blog/private-post').update(likeChange);
  const privateStudyLike = db.doc('study/private-post').update(likeChange);
  const privateIndexLike = db.doc('post_index/blog/posts/private-post').update(likeChange);

  // Then: every private-object mutation is denied.
  await assertFails(privateBlogLike);
  await assertFails(privateStudyLike);
  await assertFails(privateIndexLike);
});

test('post like is an atomic membership and aggregate update', async () => {
  // Given: a signed-in user, a public post, and its public index.
  const db = testEnv.authenticatedContext('user-a').firestore();
  const postRef = db.doc('blog/post-a');
  const indexRef = db.doc('post_index/blog/posts/post-a');
  const membershipRef = postRef.collection('likes').doc('user-a');

  // When: one batch creates membership and updates both aggregate copies.
  const batch = db.batch();
  batch.set(membershipRef, { createdAt: timestamp() });
  batch.update(postRef, { likeCount: increment(1) });
  batch.update(indexRef, { likeCount: increment(1) });

  // Then: the complete transition succeeds and no public UID array is created.
  await assertSucceeds(batch.commit());
  const post = await postRef.get();
  expect(post.data().likeCount).toBe(1);
  expect(post.data().likedBy).toBeUndefined();
});

test('post like rejects a partial aggregate update', async () => {
  // Given: a signed-in user and an absent membership document.
  const db = testEnv.authenticatedContext('user-a').firestore();
  const postRef = db.doc('blog/post-a');
  const membershipRef = postRef.collection('likes').doc('user-a');

  // When: a batch omits the matching index update.
  const batch = db.batch();
  batch.set(membershipRef, { createdAt: timestamp() });
  batch.update(postRef, { likeCount: increment(1) });

  // Then: the incomplete state transition is denied atomically.
  await assertFails(batch.commit());
});

test('signed-in user can read only their own post like membership', async () => {
  // Given: membership documents for the caller and another user.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('blog/post-a/likes/user-a').set({ createdAt: new Date() });
    await db.doc('blog/post-a/likes/user-b').set({ createdAt: new Date() });
  });
  const db = testEnv.authenticatedContext('user-a').firestore();

  // When: the caller reads both membership documents.
  const readOwn = db.doc('blog/post-a/likes/user-a').get();
  const readOther = db.doc('blog/post-a/likes/user-b').get();

  // Then: only the caller-owned membership is visible.
  await assertSucceeds(readOwn);
  await assertFails(readOther);
});

test('only administrators can list post like memberships for cleanup', async () => {
  // Given: one post like membership and both administrator and user contexts.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore()
      .doc('blog/post-a/likes/user-a')
      .set({ createdAt: new Date() });
  });
  const adminDb = testEnv.authenticatedContext('cleanup-admin-uid', { admin: true }).firestore();
  const userDb = testEnv.authenticatedContext('user-a').firestore();

  // When: both callers list memberships for the same post.
  // Then: lifecycle cleanup works for administrators without exposing the list to users.
  await assertSucceeds(adminDb.collection('blog/post-a/likes').get());
  await assertFails(userDb.collection('blog/post-a/likes').get());
});

test('like cannot be created below a missing comment', async () => {
  // Given: a signed-in user and no parent comment document.
  const db = testEnv.authenticatedContext('user-a').firestore();

  // When: the user creates a like below the missing parent.
  const orphanLike = db
    .doc('blog/post-a/comments/missing-comment/likes/user-a')
    .set({ createdAt: timestamp() });

  // Then: the orphan subcollection write is denied.
  await assertFails(orphanLike);
});
