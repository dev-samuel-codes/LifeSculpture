import { getDocs, writeBatch } from 'firebase/firestore';
import {
  deletePost,
  setPostLike,
  setPostVisibility,
  updatePostFields,
} from './posts';

jest.mock('../firebase/firebase', () => ({
  auth: { name: 'auth' },
  db: { name: 'db' },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((parent, ...segments) => ({ parent, segments })),
  deleteDoc: jest.fn(),
  doc: jest.fn((parent, id) => ({ id, parent })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn((value) => ({ increment: value })),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => ({ serverTimestamp: true })),
  startAfter: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));

let batch;

beforeEach(() => {
  jest.clearAllMocks();
  batch = {
    commit: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
  };
  writeBatch.mockReturnValue(batch);
});

test('writes post membership and both aggregates in one like batch', async () => {
  // Given: a signed-in viewer liking a public post.

  // When: the like service commits the state transition.
  await setPostLike({ category: 'blog', id: 'post-a', uid: 'user-a', like: true });

  // Then: membership and both aggregates share one atomic commit.
  expect(batch.set).toHaveBeenCalledTimes(1);
  expect(batch.update).toHaveBeenCalledTimes(2);
  expect(batch.commit).toHaveBeenCalledTimes(1);
});

test('updates visibility, private content, and index in one batch', async () => {
  // Given: content whose image URLs were rotated before becoming private.
  const content = '<p>private content</p>';

  // When: the visibility service persists the private transition.
  await setPostVisibility({
    category: 'blog',
    id: 'post-a',
    isPublic: false,
    content,
  });

  // Then: the post and index changes commit atomically.
  expect(batch.update).toHaveBeenCalledTimes(2);
  expect(batch.update.mock.calls[0][1]).toEqual({ content, isPublic: false });
  expect(batch.update.mock.calls[1][1]).toEqual({ isPublic: false });
  expect(batch.commit).toHaveBeenCalledTimes(1);
});

test('deletes post like memberships with the post and index', async () => {
  // Given: a post has one user like membership.
  getDocs.mockResolvedValue({
    docs: [{ ref: { path: 'blog/post-a/likes/user-a' } }],
    size: 1,
  });

  // When: the administrator deletes the post.
  await deletePost({ category: 'blog', id: 'post-a' });

  // Then: membership, post, and index are removed in one batch.
  expect(batch.delete).toHaveBeenCalledTimes(3);
  expect(batch.delete).toHaveBeenCalledWith(
    expect.objectContaining({ path: 'blog/post-a/likes/user-a' }),
  );
  expect(batch.commit).toHaveBeenCalledTimes(1);
});

test('updates post visibility metadata and index atomically', async () => {
  const data = {
    content: '<p>private</p>',
    isPublic: false,
    tags: ['private'],
    title: 'Private post',
  };

  await updatePostFields({ category: 'blog', id: 'post-a', data });

  expect(batch.update).toHaveBeenCalledTimes(2);
  expect(batch.update.mock.calls[0][1]).toEqual(data);
  expect(batch.update.mock.calls[1][1]).toEqual({
    isPublic: false,
    tags: ['private'],
    title: 'Private post',
  });
  expect(batch.commit).toHaveBeenCalledTimes(1);
});
