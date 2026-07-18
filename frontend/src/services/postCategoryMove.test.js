import { auth } from '../firebase/firebase';
import { movePostCategory } from './posts';
import { MAX_ATOMIC_MOVE_LIKES } from './postCategoryMove';
import {
  collection,
  deleteField,
  doc,
  getDocFromServer,
  getDocs,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

jest.mock('../firebase/firebase', () => ({
  auth: { currentUser: null },
  db: { name: 'db' },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  deleteField: jest.fn(),
  doc: jest.fn(),
  getDocFromServer: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
  startAfter: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));

const DELETE_SENTINEL = Symbol('delete-field');
const toPath = (value) => value?.path || value?.name || String(value);
const snapshotFor = (path, data) => ({
  id: path.split('/').pop(),
  exists: () => data !== undefined,
  data: () => data,
  ref: { path },
});

let store;
let sourceLikes;
let legacyComments;
let transactionCall;
let transactionFailure;

const applyUpdate = (path, updates) => {
  const current = { ...(store.get(path) || {}) };
  Object.entries(updates).forEach(([key, value]) => {
    if (value === DELETE_SENTINEL) delete current[key];
    else current[key] = value;
  });
  store.set(path, current);
};

const createTransaction = () => {
  const operations = [];
  return {
    get: jest.fn(async (reference) => snapshotFor(reference.path, store.get(reference.path))),
    set: jest.fn((reference, data) => operations.push(['set', reference.path, data])),
    update: jest.fn((reference, data) => operations.push(['update', reference.path, data])),
    delete: jest.fn((reference) => operations.push(['delete', reference.path])),
    apply: () => operations.forEach(([type, path, data]) => {
      if (type === 'set') store.set(path, data);
      if (type === 'update') applyUpdate(path, data);
      if (type === 'delete') store.delete(path);
    }),
  };
};

const configureFirestore = () => {
  collection.mockImplementation((...segments) => ({
    path: segments.map(toPath).join('/'),
  }));
  doc.mockImplementation((...segments) => ({
    path: segments.map(toPath).join('/'),
  }));
  deleteField.mockReturnValue(DELETE_SENTINEL);
  getDocFromServer.mockImplementation(async (reference) =>
    snapshotFor(reference.path, store.get(reference.path)));
  getDocs.mockImplementation(async (reference) => {
    if (reference.path === 'db/blog/post-a/likes') {
      return {
        docs: sourceLikes.map((like) => ({
          id: like.id,
          data: () => like.data,
          ref: { path: `db/blog/post-a/likes/${like.id}` },
        })),
        size: sourceLikes.length,
      };
    }
    if (reference.path === 'db/blog/post-a/comments') {
      return {
        docs: legacyComments.map((comment) => ({
          id: comment.id,
          data: () => comment.data,
          ref: { path: `db/blog/post-a/comments/${comment.id}` },
        })),
        size: legacyComments.length,
      };
    }
    const comment = legacyComments.find((entry) =>
      reference.path === `db/blog/post-a/comments/${entry.id}/likes`);
    if (comment) {
      return {
        docs: comment.likes.map((uid) => ({
          id: uid,
          data: () => ({ createdAt: 'time' }),
          ref: { path: `db/blog/post-a/comments/${comment.id}/likes/${uid}` },
        })),
        size: comment.likes.length,
      };
    }
    return { docs: [], size: 0 };
  });
  runTransaction.mockImplementation(async (_db, callback) => {
    transactionCall += 1;
    const failure = transactionFailure?.call === transactionCall ? transactionFailure : null;
    if (failure && !failure.afterCommit) throw failure.error;
    const transaction = createTransaction();
    const result = await callback(transaction);
    transaction.apply();
    if (failure?.afterCommit) throw failure.error;
    return result;
  });
  writeBatch.mockImplementation(() => {
    const deletes = [];
    return {
      delete: jest.fn((reference) => deletes.push(reference.path)),
      set: jest.fn(),
      commit: jest.fn(async () => deletes.forEach((path) => store.delete(path))),
    };
  });
};

const seedSource = ({ likeCount = 0 } = {}) => {
  store.set('db/blog/post-a', {
    title: '원본',
    category: 'blog',
    isPublic: true,
    likeCount,
  });
  store.set('db/post_index/blog/posts/post-a', {
    title: '원본',
    isPublic: true,
    likeCount,
  });
  sourceLikes = Array.from({ length: likeCount }, (_, index) => ({
    id: `user-${index}`,
    data: { createdAt: 'time' },
  }));
};

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = { getIdToken: jest.fn().mockResolvedValue('test-token') };
  store = new Map();
  sourceLikes = [];
  legacyComments = [];
  transactionCall = 0;
  transactionFailure = null;
  configureFirestore();
});

test('rejects category movement without an authenticated user', async () => {
  auth.currentUser = null;
  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
  })).rejects.toThrow('로그인이 필요합니다.');
});

test('rejects identical or unsupported categories', async () => {
  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'blog',
    id: 'post-a',
  })).rejects.toThrow('같은 카테고리로는 이동할 수 없습니다.');
  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'archive',
    id: 'post-a',
  })).rejects.toThrow('카테고리가 올바르지 않습니다.');
});

test('locks the source and atomically moves the post, likes, and legacy comments', async () => {
  seedSource({ likeCount: 1 });
  legacyComments = [{ id: 'comment-a', data: {}, likes: ['comment-user'] }];
  store.set('db/blog/post-a/comments/comment-a', {});
  store.set('db/blog/post-a/comments/comment-a/likes/comment-user', {});

  const result = await movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
    data: { title: '이동됨' },
  });

  expect(runTransaction).toHaveBeenCalledTimes(2);
  expect(store.get('db/study/post-a')).toEqual(expect.objectContaining({
    title: '이동됨',
    category: 'study',
    isPublic: true,
  }));
  expect(store.get('db/study/post-a/likes/user-0')).toEqual({ createdAt: 'time' });
  expect(store.has('db/blog/post-a')).toBe(false);
  expect(store.has('db/blog/post-a/comments/comment-a')).toBe(false);
  expect(store.has('db/blog/post-a/comments/comment-a/likes/comment-user')).toBe(false);
  expect(result.postLikeCount).toBe(1);
});

test('allows exactly 248 likes and rejects the next write before a partial move', async () => {
  seedSource({ likeCount: MAX_ATOMIC_MOVE_LIKES });
  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
  })).resolves.toEqual(expect.objectContaining({ postLikeCount: MAX_ATOMIC_MOVE_LIKES }));

  store = new Map();
  transactionCall = 0;
  seedSource({ likeCount: MAX_ATOMIC_MOVE_LIKES + 1 });
  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
  })).rejects.toThrow('단일 트랜잭션으로 이동할 수 없습니다.');
  expect(store.get('db/blog/post-a')).toEqual(expect.objectContaining({ isPublic: true }));
  expect(store.has('db/study/post-a')).toBe(false);
  expect(store.has('db/post_move_jobs/blog--study--post-a')).toBe(false);
});

test('restores the source when the final transaction fails before commit', async () => {
  seedSource({ likeCount: 1 });
  const commitError = new Error('commit failed');
  transactionFailure = { call: 2, afterCommit: false, error: commitError };

  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
  })).rejects.toBe(commitError);
  expect(store.get('db/blog/post-a')).toEqual(expect.objectContaining({ isPublic: true }));
  expect(store.has('db/study/post-a')).toBe(false);
});

test('uses server snapshots and treats a lost response after commit as success', async () => {
  seedSource({ likeCount: 1 });
  transactionFailure = { call: 2, afterCommit: true, error: new Error('response lost') };

  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
  })).resolves.toEqual(expect.objectContaining({
    fromCategory: 'blog',
    toCategory: 'study',
  }));
  expect(getDocFromServer).toHaveBeenCalled();
  expect(store.has('db/blog/post-a')).toBe(false);
  expect(store.has('db/study/post-a')).toBe(true);
});

test('keeps a persistent cleanup job when a rolled-back move has prepared images', async () => {
  seedSource();
  transactionFailure = { call: 2, afterCommit: false, error: new Error('commit failed') };

  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
    preparedStorageCleanup: {
      urls: ['https://storage/new-image'],
      pathPrefixes: ['post-images/study/post-a'],
    },
  })).rejects.toMatchObject({
    preservePreparedImages: true,
    moveRolledBack: true,
    moveJobId: 'blog--study--post-a',
  });
  expect(store.get('db/post_move_jobs/blog--study--post-a')).toEqual(expect.objectContaining({
    preparedImageUrls: ['https://storage/new-image'],
  }));
  expect(store.get('db/blog/post-a')).toEqual(expect.objectContaining({ isPublic: true }));
});

test('does not trust cached state when the server state cannot be verified', async () => {
  seedSource();
  transactionFailure = { call: 2, afterCommit: false, error: new Error('unknown state') };
  getDocFromServer.mockRejectedValue(new Error('offline'));

  await expect(movePostCategory({
    fromCategory: 'blog',
    toCategory: 'study',
    id: 'post-a',
    preparedStorageCleanup: { urls: ['https://storage/new-image'] },
  })).rejects.toMatchObject({ preservePreparedImages: true });
  expect(store.has('db/post_move_jobs/blog--study--post-a')).toBe(true);
});
