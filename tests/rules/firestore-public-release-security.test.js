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
      viewCount: 0,
      likeCount: 0,
    };
    const privatePost = {
      title: 'Private Post',
      isPublic: false,
      viewCount: 0,
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
    ]);
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

test('anonymous and normal users cannot read private posts or private indexes', async () => {
  // Given: public/private post documents and matching list indexes.
  const anonymousDb = testEnv.unauthenticatedContext().firestore();
  const userDb = testEnv.authenticatedContext('user-a').firestore();
  const adminDb = testEnv.authenticatedContext('admin-uid').firestore();

  // Then: public content remains readable to visitors.
  await assertSucceeds(anonymousDb.doc('blog/post-a').get());
  await assertSucceeds(userDb.doc('study/post-a').get());
  await assertSucceeds(anonymousDb.doc('post_index/blog/posts/post-a').get());

  // And: private content cannot be bypassed with direct document reads.
  for (const documentPath of [
    'blog/private-post',
    'study/private-post',
    'post_index/blog/posts/private-post',
  ]) {
    await assertFails(anonymousDb.doc(documentPath).get());
    await assertFails(userDb.doc(documentPath).get());
    await assertSucceeds(adminDb.doc(documentPath).get());
  }

  // And: an unfiltered collection read cannot return a mix containing private posts.
  await assertFails(anonymousDb.collection('blog').get());
  await assertSucceeds(
    anonymousDb.collection('blog').where('isPublic', '==', true).get(),
  );
});

test('user documents cannot be exposed by a permissive top-level wildcard', async () => {
  // Given: anonymous, normal-user, and administrator contexts.
  const anonymousDb = testEnv.unauthenticatedContext().firestore();
  const userDb = testEnv.authenticatedContext('user-a').firestore();
  const adminDb = testEnv.authenticatedContext('admin-uid').firestore();

  // Then: only administrators can read user profile/role documents.
  await assertFails(anonymousDb.doc('users/admin-uid').get());
  await assertFails(userDb.doc('users/admin-uid').get());
  await assertFails(userDb.doc('users/user-a').get());
  await assertSucceeds(adminDb.doc('users/user-a').get());
});

test('public posts reject direct view and arbitrary like tampering', async () => {
  // Given: public post/index documents and untrusted caller contexts.
  const anonymousDb = testEnv.unauthenticatedContext().firestore();
  const userDb = testEnv.authenticatedContext('user-a').firestore();

  // Then: view counts cannot be incremented directly by visitors or normal users.
  await assertFails(anonymousDb.doc('blog/post-a').update({ viewCount: increment(1) }));
  await assertFails(userDb.doc('blog/post-a').update({ viewCount: increment(1) }));
  await assertFails(
    userDb.doc('post_index/blog/posts/post-a').update({ viewCount: increment(1) }),
  );

  // And: aggregate likes cannot be forged without the caller-owned membership transition.
  await assertFails(userDb.doc('blog/post-a').update({ likeCount: increment(10) }));
  await assertFails(
    userDb.doc('post_index/blog/posts/post-a').update({ likeCount: increment(10) }),
  );
  await assertFails(
    userDb.doc('blog/post-a').update({ likedBy: arrayUnion('user-b') }),
  );
});

test('administrators can remove foreign likes and legacy comment data during a move', async () => {
  // Given: data created by another user that an administrator must clean up during a move.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('blog/post-a/likes/user-b').set({ createdAt: new Date() });
    await db.doc('blog/post-a/comments/comment-a').set({ authorId: 'user-b' });
    await db.doc('blog/post-a/comments/comment-a/likes/user-b').set({ createdAt: new Date() });
  });

  const userDb = testEnv.authenticatedContext('user-a').firestore();
  const adminDb = testEnv.authenticatedContext('cleanup-admin-uid', { admin: true }).firestore();

  // Then: a normal user cannot remove somebody else's cleanup data.
  await assertFails(userDb.doc('blog/post-a/likes/user-b').delete());
  await assertFails(userDb.doc('blog/post-a/comments/comment-a/likes/user-b').delete());

  // But an administrator can remove both, so an atomic category move is not blocked by ownership.
  await assertSucceeds(adminDb.doc('blog/post-a/likes/user-b').delete());
  await assertSucceeds(adminDb.doc('blog/post-a/comments/comment-a/likes/user-b').delete());
  await assertSucceeds(adminDb.doc('blog/post-a/comments/comment-a').delete());
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

test('post deletion cleanup jobs are restricted to administrators', async () => {
  const adminDb = testEnv.authenticatedContext('admin-uid').firestore();
  const userDb = testEnv.authenticatedContext('user-a').firestore();
  const jobData = {
    category: 'blog',
    postId: 'post-a',
    urls: [],
    pathPrefixes: ['post-images/blog/post-a'],
    createdAt: timestamp(),
  };

  await assertFails(userDb.doc('post_deletion_jobs/blog--post-a').set(jobData));
  await assertSucceeds(adminDb.doc('post_deletion_jobs/blog--post-a').set(jobData));
  await assertFails(userDb.doc('post_deletion_jobs/blog--post-a').get());
  await assertSucceeds(adminDb.doc('post_deletion_jobs/blog--post-a').get());
  await assertFails(userDb.collection('post_deletion_jobs').get());
  await assertSucceeds(adminDb.collection('post_deletion_jobs').get());
  await assertFails(userDb.doc('post_deletion_jobs/blog--post-a').delete());
  await assertSucceeds(adminDb.doc('post_deletion_jobs/blog--post-a').delete());
});

test('post category move jobs are restricted to administrators', async () => {
  const adminDb = testEnv.authenticatedContext('admin-uid').firestore();
  const userDb = testEnv.authenticatedContext('user-a').firestore();
  const jobData = {
    sourceCategory: 'blog',
    targetCategory: 'study',
    postId: 'post-a',
    originalIsPublic: true,
    preparedImageUrls: [],
    preparedPathPrefixes: ['post-images/study/post-a'],
    createdAt: timestamp(),
  };

  await assertFails(userDb.doc('post_move_jobs/blog--study--post-a').set(jobData));
  await assertSucceeds(adminDb.doc('post_move_jobs/blog--study--post-a').set(jobData));
  await assertFails(userDb.collection('post_move_jobs').get());
  await assertSucceeds(adminDb.collection('post_move_jobs').get());
  await assertFails(userDb.doc('post_move_jobs/blog--study--post-a').delete());
  await assertSucceeds(adminDb.doc('post_move_jobs/blog--study--post-a').delete());
});
