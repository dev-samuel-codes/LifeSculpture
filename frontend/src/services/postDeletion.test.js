import { deleteStorageImages, getOwnedStorageImageUrls } from '../utils/storage';
import { deletePost } from './posts';
import { deletePostWithStorage } from './postDeletion';
import {
  cleanupPendingStorage,
  transitionPostVisibility,
} from './postVisibilityTransition';

jest.mock('../utils/storage', () => ({
  deleteStorageImages: jest.fn(),
  getOwnedStorageImageUrls: jest.fn(),
}));

jest.mock('./posts', () => ({
  deletePost: jest.fn(),
}));

jest.mock('./postVisibilityTransition', () => ({
  cleanupPendingStorage: jest.fn(),
  transitionPostVisibility: jest.fn(),
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
  transitionPostVisibility.mockResolvedValue({
    content: '<img src="private-url">',
    isPublic: false,
  });
  getOwnedStorageImageUrls.mockReturnValue(['private-url']);
  deleteStorageImages.mockResolvedValue(1);
  deletePost.mockResolvedValue(undefined);
});

test('tombstones a public post before deleting images and data', async () => {
  const onTombstoned = jest.fn();

  await deletePostWithStorage({ ...input, onTombstoned });

  expect(transitionPostVisibility).toHaveBeenCalled();
  expect(onTombstoned).toHaveBeenCalledWith(expect.objectContaining({ isPublic: false }));
  expect(deleteStorageImages).toHaveBeenCalledWith(expect.objectContaining({
    urls: ['private-url'],
  }));
  expect(deletePost).toHaveBeenCalledWith({ category: 'blog', id: 'post-a' });
});

test('keeps the private post when storage cleanup fails', async () => {
  deleteStorageImages.mockRejectedValue(new Error('cleanup failed'));

  await expect(deletePostWithStorage(input)).rejects.toThrow('cleanup failed');

  expect(deletePost).not.toHaveBeenCalled();
});

test('retries pending cleanup for an already private post', async () => {
  await deletePostWithStorage({ ...input, isPublic: false });

  expect(cleanupPendingStorage).toHaveBeenCalled();
  expect(transitionPostVisibility).not.toHaveBeenCalled();
});
