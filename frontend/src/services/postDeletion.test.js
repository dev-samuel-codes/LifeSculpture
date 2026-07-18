import { deleteStorageImages, getOwnedStorageImageUrls } from '../utils/storage';
import {
  deletePostWithStorage,
  retryPendingPostDeletionCleanups,
} from './postDeletion';
import {
  assertPostDeletionFitsBatch,
  completePostDeletionJob,
  deletePost,
  listPostDeletionJobs,
  setPostVisibility,
} from './posts';

jest.mock('../utils/storage', () => ({
  deleteStorageImages: jest.fn(),
  getOwnedStorageImageUrls: jest.fn(),
}));

jest.mock('./posts', () => ({
  assertPostDeletionFitsBatch: jest.fn(),
  completePostDeletionJob: jest.fn(),
  deletePost: jest.fn(),
  listPostDeletionJobs: jest.fn(),
  setPostVisibility: jest.fn(),
}));

const input = {
  category: 'blog',
  id: 'post-a',
  post: { content: '<img src="old-url">' },
  isPublic: true,
  storage: { name: 'storage' },
  uid: 'admin-a',
  role: 'admin',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  assertPostDeletionFitsBatch.mockResolvedValue(0);
  setPostVisibility.mockResolvedValue(undefined);
  getOwnedStorageImageUrls.mockReturnValue(['old-url']);
  deleteStorageImages.mockResolvedValue(1);
  deletePost.mockResolvedValue({ jobId: 'blog--post-a' });
  completePostDeletionJob.mockResolvedValue(undefined);
  listPostDeletionJobs.mockResolvedValue([]);
});

afterEach(() => {
  console.warn.mockRestore();
});

test('commits Firestore deletion and cleanup ledger before deleting images', async () => {
  const onTombstoned = jest.fn();

  const result = await deletePostWithStorage({ ...input, onTombstoned });

  expect(assertPostDeletionFitsBatch).toHaveBeenCalledWith({
    category: 'blog',
    id: 'post-a',
  });
  expect(setPostVisibility).toHaveBeenCalledWith({
    category: 'blog',
    id: 'post-a',
    isPublic: false,
  });
  expect(onTombstoned).toHaveBeenCalledWith(expect.objectContaining({ isPublic: false }));
  expect(deletePost).toHaveBeenCalledWith({
    category: 'blog',
    id: 'post-a',
    storageCleanup: {
      pathPrefixes: ['post-images/blog/post-a'],
      urls: ['old-url'],
    },
  });
  expect(deletePost.mock.invocationCallOrder[0]).toBeLessThan(
    deleteStorageImages.mock.invocationCallOrder[0],
  );
  expect(completePostDeletionJob).toHaveBeenCalledWith({ jobId: 'blog--post-a' });
  expect(result).toEqual({ storageCleanupPending: false });
});

test('keeps the cleanup ledger when image deletion partially fails', async () => {
  deleteStorageImages.mockRejectedValue(new Error('cleanup failed'));

  await expect(deletePostWithStorage(input)).resolves.toEqual({
    storageCleanupPending: true,
  });

  expect(deletePost).toHaveBeenCalled();
  expect(completePostDeletionJob).not.toHaveBeenCalled();
});

test('never deletes images when the atomic Firestore deletion fails', async () => {
  deletePost.mockRejectedValue(new Error('firestore failed'));

  await expect(deletePostWithStorage(input)).rejects.toThrow('firestore failed');

  expect(deleteStorageImages).not.toHaveBeenCalled();
  expect(completePostDeletionJob).not.toHaveBeenCalled();
  expect(setPostVisibility).toHaveBeenLastCalledWith({
    category: 'blog',
    id: 'post-a',
    isPublic: true,
  });
});

test('rejects an oversized deletion before changing visibility or images', async () => {
  assertPostDeletionFitsBatch.mockRejectedValue(new Error('too many related documents'));

  await expect(deletePostWithStorage(input)).rejects.toThrow('too many related documents');

  expect(setPostVisibility).not.toHaveBeenCalled();
  expect(deletePost).not.toHaveBeenCalled();
  expect(deleteStorageImages).not.toHaveBeenCalled();
});

test('does not alter visibility or images before deleting an already private post', async () => {
  await deletePostWithStorage({ ...input, isPublic: false });

  expect(setPostVisibility).not.toHaveBeenCalled();
  expect(deletePost.mock.invocationCallOrder[0]).toBeLessThan(
    deleteStorageImages.mock.invocationCallOrder[0],
  );
});

test('retries persisted image cleanup jobs idempotently', async () => {
  listPostDeletionJobs.mockResolvedValue([{
    id: 'blog--post-a',
    urls: ['private-url'],
    pathPrefixes: ['post-images/blog/post-a'],
  }]);

  const result = await retryPendingPostDeletionCleanups({
    storage: input.storage,
    uid: input.uid,
    role: input.role,
  });

  expect(deleteStorageImages).toHaveBeenCalledWith({
    urls: ['private-url'],
    storage: input.storage,
    uid: input.uid,
    role: input.role,
    pathPrefixes: ['post-images/blog/post-a'],
  });
  expect(completePostDeletionJob).toHaveBeenCalledWith({ jobId: 'blog--post-a' });
  expect(result).toEqual({ completed: 1, pending: 0 });
});
