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
    await db.doc('blog/post-a').set({
      title: 'Post A',
      viewCount: 0,
      likeCount: 0,
      likedBy: [],
      isPublic: true,
    });
    await db.doc('users/admin-uid').set({
      email: 'admin@example.invalid',
      role: 'admin',
    });
    await db.doc('users/user-a').set({
      email: 'user@example.invalid',
      role: 'user',
    });
    await db.doc('blog/post-a/comments/comment-a').set({
      authorId: 'user-a',
      authorName: 'User A',
      authorPhoto: null,
      content: 'hello',
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

test('signed-in user can create a comment without client counters', async () => {
  const db = testEnv.authenticatedContext('user-a').firestore();
  const commentRef = db.doc('blog/post-a/comments/comment-new');

  await assertSucceeds(commentRef.set({
    authorId: 'user-a',
    authorName: 'User A',
    authorPhoto: null,
    content: 'hello',
    parentId: null,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }));
});

test('signed-in user cannot create a comment with likeCount or replyCount', async () => {
  const db = testEnv.authenticatedContext('user-a').firestore();
  const commentRef = db.doc('blog/post-a/comments/comment-new');

  await assertFails(commentRef.set({
    authorId: 'user-a',
    authorName: 'User A',
    authorPhoto: null,
    content: 'hello',
    parentId: null,
    likeCount: 0,
    replyCount: 0,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }));
});

test('signed-in user can create and delete own comment like doc', async () => {
  const db = testEnv.authenticatedContext('user-a').firestore();
  const likeRef = db.doc('blog/post-a/comments/comment-a/likes/user-a');

  await assertSucceeds(likeRef.set({ createdAt: timestamp() }));
  await assertSucceeds(likeRef.delete());
});

test('signed-in user cannot create another user comment like doc', async () => {
  const db = testEnv.authenticatedContext('user-a').firestore();
  const likeRef = db.doc('blog/post-a/comments/comment-a/likes/user-b');

  await assertFails(likeRef.set({ createdAt: timestamp() }));
});

test('signed-in user cannot update parent comment likeCount directly', async () => {
  const db = testEnv.authenticatedContext('user-a').firestore();
  const commentRef = db.doc('blog/post-a/comments/comment-a');

  await assertFails(commentRef.update({ likeCount: increment(1) }));
});

test('post like legacy update cannot make likeCount negative', async () => {
  const db = testEnv.authenticatedContext('user-a').firestore();
  const postRef = db.doc('blog/post-a');

  await assertFails(postRef.update({ likeCount: -1 }));
});

test('unauthenticated user cannot read user profiles', async () => {
  // Given: a user profile exists in Firestore.
  const db = testEnv.unauthenticatedContext().firestore();

  // When: an unauthenticated client reads that profile.
  const readProfile = db.doc('users/user-a').get();

  // Then: the read is denied.
  await assertFails(readProfile);
});

test('admin can read user profiles', async () => {
  // Given: the caller has the admin role.
  const db = testEnv.authenticatedContext('admin-uid').firestore();

  // When: the admin reads a user profile.
  const readProfile = db.doc('users/user-a').get();

  // Then: the read succeeds.
  await assertSucceeds(readProfile);
});

test('signed-in user can add only their own post like', async () => {
  // Given: a signed-in user and an unliked post.
  const db = testEnv.authenticatedContext('user-a').firestore();
  const postRef = db.doc('blog/post-a');

  // When: the user adds their own uid and increments the count once.
  const addOwnLike = postRef.update({
    likeCount: increment(1),
    likedBy: arrayUnion('user-a'),
  });

  // Then: the update succeeds.
  await assertSucceeds(addOwnLike);
});

test('signed-in user cannot overwrite post likes with arbitrary values', async () => {
  // Given: a signed-in user and an existing post.
  const db = testEnv.authenticatedContext('user-a').firestore();
  const postRef = db.doc('blog/post-a');

  // When: the user impersonates another uid and replaces the count.
  const overwriteLikes = postRef.update({
    likeCount: 999999,
    likedBy: ['user-a', 'victim'],
  });

  // Then: the update is denied.
  await assertFails(overwriteLikes);
});
