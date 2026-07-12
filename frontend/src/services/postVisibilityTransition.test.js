import {
  deleteStorageImages,
  preparePrivateImageContent,
} from '../utils/storage';
import { setPostVisibility, updatePostFields } from './posts';
import {
  cleanupPendingStorage,
  transitionPostVisibility,
} from './postVisibilityTransition';

jest.mock('../utils/storage', () => ({
  deleteStorageImages: jest.fn(),
  preparePrivateImageContent: jest.fn(),
}));

jest.mock('./posts', () => ({
  setPostVisibility: jest.fn(),
  updatePostFields: jest.fn(),
}));

const input = {
  category: 'blog',
  id: 'post-a',
  content: '<img src="old-url">',
  isPublic: true,
  storage: { name: 'storage' },
  uid: 'admin-a',
  role: 'admin',
};

beforeEach(() => {
  jest.clearAllMocks();
  preparePrivateImageContent.mockResolvedValue({
    content: '<img src="private-url">',
    originalUrls: ['old-url'],
    privateUrls: ['private-url'],
  });
  deleteStorageImages.mockResolvedValue(1);
  setPostVisibility.mockResolvedValue(undefined);
  updatePostFields.mockResolvedValue(undefined);
});

test('publishes a private post without rotating images', async () => {
  const result = await transitionPostVisibility({ ...input, isPublic: false });

  expect(preparePrivateImageContent).not.toHaveBeenCalled();
  expect(setPostVisibility).toHaveBeenCalledWith({
    category: 'blog',
    id: 'post-a',
    isPublic: true,
  });
  expect(result).toEqual({ content: input.content, isPublic: true });
});

test('switches content before deleting old public image capabilities', async () => {
  const result = await transitionPostVisibility(input);

  expect(setPostVisibility).toHaveBeenCalledWith({
    category: 'blog',
    id: 'post-a',
    isPublic: false,
    content: '<img src="private-url">',
    pendingStorageCleanup: {
      urls: ['old-url'],
      pathPrefixes: ['post-images/blog/post-a'],
    },
  });
  expect(deleteStorageImages).toHaveBeenCalledWith(expect.objectContaining({
    urls: ['old-url'],
  }));
  expect(updatePostFields).toHaveBeenCalledWith({
    category: 'blog',
    id: 'post-a',
    data: { pendingStorageCleanup: null },
  });
  expect(result).toEqual({
    content: '<img src="private-url">',
    isPublic: false,
    pendingStorageCleanup: null,
  });
});

test('restores public visibility when old capability cleanup fails', async () => {
  deleteStorageImages.mockRejectedValueOnce(new Error('cleanup failed'));

  await expect(transitionPostVisibility(input)).rejects.toThrow('cleanup failed');
  expect(setPostVisibility).toHaveBeenLastCalledWith({
    category: 'blog',
    id: 'post-a',
    isPublic: true,
    content: '<img src="private-url">',
  });
});

test('retries pending storage cleanup before another visibility transition', async () => {
  const pendingStorageCleanup = {
    urls: ['old-url'],
    pathPrefixes: ['post-images/blog/post-a'],
  };

  await cleanupPendingStorage({
    ...input,
    pendingStorageCleanup,
  });

  expect(deleteStorageImages).toHaveBeenCalledWith(expect.objectContaining({
    urls: ['old-url'],
    pathPrefixes: ['post-images/blog/post-a'],
  }));
  expect(updatePostFields).toHaveBeenCalledWith({
    category: 'blog',
    id: 'post-a',
    data: { pendingStorageCleanup: null },
  });
});
