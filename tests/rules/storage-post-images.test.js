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
    await context.firestore().doc('users/admin-uid').set({ role: 'admin' });
    await context.firestore().doc('users/user-uid').set({ role: 'user' });
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
