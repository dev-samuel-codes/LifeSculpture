require('firebase/compat/storage');
const {
  assertFails,
  assertSucceeds,
  createRulesTestEnv,
} = require('./setup');

let testEnv;

beforeAll(async () => {
  testEnv = await createRulesTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('users/admin-uid').set({ role: 'admin' });
    await db.doc('users/user-uid').set({ role: 'user' });
    await db.doc('blog/post-a').set({ isPublic: true });
    await db.doc('blog/private-post').set({ isPublic: false });

    await context.storage().ref('post-images/blog/post-a/public.jpg').putString(
      'public-image',
      'raw',
      { contentType: 'image/jpeg' },
    );
    await context.storage().ref('post-images/blog/private-post/private.jpg').putString(
      'private-image',
      'raw',
      { contentType: 'image/jpeg' },
    );
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const postImageRef = (context, fileName) =>
  context.storage().ref(`post-images/blog/post-a/${fileName}`);

test('admin can upload jpeg under size limit', async () => {
  const ref = postImageRef(testEnv.authenticatedContext('admin-uid'), 'image.jpg');

  await assertSucceeds(ref.putString('image-data', 'raw', {
    contentType: 'image/jpeg',
  }));
});

test('normal user cannot upload post image', async () => {
  const ref = postImageRef(testEnv.authenticatedContext('user-uid'), 'image.jpg');

  await assertFails(ref.putString('image-data', 'raw', {
    contentType: 'image/jpeg',
  }));
});

test('admin cannot upload svg', async () => {
  const ref = postImageRef(testEnv.authenticatedContext('admin-uid'), 'image.svg');

  await assertFails(ref.putString('<svg></svg>', 'raw', {
    contentType: 'image/svg+xml',
  }));
});

test('admin cannot upload file over size limit', async () => {
  const ref = postImageRef(testEnv.authenticatedContext('admin-uid'), 'large.jpg');
  const oversized = 'x'.repeat(5 * 1024 * 1024);

  await assertFails(ref.putString(oversized, 'raw', {
    contentType: 'image/jpeg',
  }));
});

test('admin can delete post image', async () => {
  const adminContext = testEnv.authenticatedContext('admin-uid');
  const ref = postImageRef(adminContext, 'image.jpg');

  await assertSucceeds(ref.putString('image-data', 'raw', {
    contentType: 'image/jpeg',
  }));
  await assertSucceeds(ref.delete());
});

test('unauthenticated user can read public post image', async () => {
  // Given: an image belongs to an explicitly public post.
  const ref = testEnv
    .unauthenticatedContext()
    .storage()
    .ref('post-images/blog/post-a/public.jpg');

  // When: an unauthenticated caller reads its metadata.
  const readMetadata = ref.getMetadata();

  // Then: the public image remains readable.
  await assertSucceeds(readMetadata);
});

test('unauthenticated user cannot read private post image', async () => {
  // Given: an image belongs to a private post.
  const ref = testEnv
    .unauthenticatedContext()
    .storage()
    .ref('post-images/blog/private-post/private.jpg');

  // When: an unauthenticated caller reads its metadata.
  const readMetadata = ref.getMetadata();

  // Then: the private image is denied.
  await assertFails(readMetadata);
});

test('admin can read private post image', async () => {
  // Given: an image belongs to a private post and the caller is an admin.
  const ref = testEnv
    .authenticatedContext('admin-uid')
    .storage()
    .ref('post-images/blog/private-post/private.jpg');

  // When: the administrator reads its metadata.
  const readMetadata = ref.getMetadata();

  // Then: administrative access remains available.
  await assertSucceeds(readMetadata);
});
