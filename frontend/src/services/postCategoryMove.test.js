import { auth } from '../firebase/firebase';
import { movePostCategory } from './posts';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

jest.mock('../firebase/firebase', () => ({
  auth: { currentUser: null },
  db: { name: 'db' },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  startAfter: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = { getIdToken: jest.fn().mockResolvedValue('test-token') };
});

test('rejects category movement without an authenticated user', async () => {
  // Given: no authenticated Firebase user.
  auth.currentUser = null;

  // When: category movement is requested.
  const movement = movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
  });

  // Then: the existing authentication error remains unchanged.
  await expect(movement).rejects.toThrow('로그인이 필요합니다.');
});

test('rejects identical source and target categories', async () => {
  // Given: an authenticated user and one valid category.

  // When: the same category is supplied as both source and target.
  const movement = movePostCategory({
    fromCategory: 'blog',
    toCategory: 'blog',
    id: 'post-a',
  });

  // Then: the existing same-category validation remains unchanged.
  await expect(movement).rejects.toThrow('같은 카테고리로는 이동할 수 없습니다.');
});

test('rejects an unsupported target category', async () => {
  // Given: an authenticated user and a supported source category.

  // When: an unsupported target category is requested.
  const movement = movePostCategory({
    fromCategory: 'blog',
    toCategory: 'archive',
    id: 'post-a',
  });

  // Then: the existing category validation remains unchanged.
  await expect(movement).rejects.toThrow('카테고리가 올바르지 않습니다.');
});

test('moves post like memberships with the post category', async () => {
  // Given: one post like membership exists under the source post.
  const batches = [];
  const toPath = (value) => value?.path || value?.name || String(value);
  collection.mockImplementation((...segments) => ({
    path: segments.map(toPath).join('/'),
  }));
  doc.mockImplementation((...segments) => ({
    path: segments.map(toPath).join('/'),
  }));
  getDoc
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ likeCount: 1 }) })
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ likeCount: 1 }) })
    .mockResolvedValueOnce({ exists: () => false });
  getDocs.mockImplementation(async (reference) => {
    if (reference.path.endsWith('/comments')) return { empty: true, docs: [], size: 0 };
    return {
      empty: false,
      docs: [{ id: 'user-a', data: () => ({ createdAt: 'time' }) }],
      size: 1,
    };
  });
  writeBatch.mockImplementation(() => {
    const batch = {
      commit: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      set: jest.fn(),
    };
    batches.push(batch);
    return batch;
  });

  // When: the administrator moves the post to another category.
  const result = await movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
  });

  // Then: the membership is copied to the target and removed from the source.
  const copiedPaths = batches.flatMap((batch) =>
    batch.set.mock.calls.map(([reference]) => reference.path));
  const deletedPaths = batches.flatMap((batch) =>
    batch.delete.mock.calls.map(([reference]) => reference.path));
  expect(copiedPaths).toContain('db/study/post-a/likes/user-a');
  expect(deletedPaths).toContain('db/blog/post-a/likes/user-a');
  expect(result.postLikeCount).toBe(1);
});
