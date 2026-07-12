import {
  deleteObject,
  getBytes,
  getDownloadURL,
  getMetadata,
  ref,
  uploadBytes,
} from 'firebase/storage';
import {
  deleteStorageImages,
  preparePrivateImageContent,
  rotateStorageDownloadTokens,
} from './storage';

jest.mock('firebase/storage', () => ({
  deleteObject: jest.fn(),
  getBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  getMetadata: jest.fn(),
  ref: jest.fn((storage, path) => ({ path, storage })),
  uploadBytes: jest.fn(),
}));

jest.mock('../components/text-editor/utils/media', () => ({
  extractImageUrls: (content) => [...content.matchAll(/src="([^"]+)"/g)].map((match) => match[1]),
  extractStoragePath: (url) => {
    const encodedPath = url.split('/o/')[1]?.split('?')[0];
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  ref.mockImplementation((storage, path) => ({ path, storage }));
});

const imageUrl = (name) =>
  `https://firebasestorage.googleapis.com/v0/b/demo/o/post-images%2Fblog%2Fpost-a%2F${name}?alt=media`;

test('rejects image cleanup without administrator authentication', async () => {
  // Given: a valid post image URL and a non-admin caller.
  const urls = [imageUrl('image.jpg')];

  // When: the caller requests privileged Storage cleanup.
  const cleanup = deleteStorageImages({
    urls,
    storage: { name: 'storage' },
    uid: 'user-a',
    role: 'user',
  });

  // Then: the operation fails before deleting any object.
  await expect(cleanup).rejects.toThrow('관리자 권한');
  expect(deleteObject).not.toHaveBeenCalled();
});

test('propagates partial image deletion failure', async () => {
  // Given: two valid images and one failing Storage deletion.
  deleteObject
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('storage unavailable'));

  // When: the administrator deletes both images.
  const cleanup = deleteStorageImages({
    urls: [imageUrl('first.jpg'), imageUrl('second.jpg')],
    storage: { name: 'storage' },
    uid: 'admin-uid',
    role: 'admin',
  });

  // Then: the caller receives an explicit aggregate failure.
  await expect(cleanup).rejects.toThrow('이미지 1개를 삭제하지 못했습니다.');
});

test('returns the number of deleted images when all cleanup succeeds', async () => {
  // Given: two valid images and successful Storage deletion calls.
  deleteObject.mockResolvedValue(undefined);

  // When: the administrator deletes both images.
  const deleted = await deleteStorageImages({
    urls: [imageUrl('first.jpg'), imageUrl('second.jpg')],
    storage: { name: 'storage' },
    uid: 'admin-uid',
    role: 'admin',
  });

  // Then: the complete deletion count is returned.
  expect(deleted).toBe(2);
});

test('treats an already deleted image as successful cleanup', async () => {
  deleteObject.mockRejectedValue({ code: 'storage/object-not-found' });

  const deleted = await deleteStorageImages({
    urls: [imageUrl('missing.jpg')],
    storage: { name: 'storage' },
    uid: 'admin-uid',
    role: 'admin',
  });

  expect(deleted).toBe(1);
});

test('rotates every image token before a post becomes private', async () => {
  // Given: a public image with bytes, metadata, and a newly issued URL.
  const oldUrl = imageUrl('image.jpg');
  const newUrl = `${oldUrl}&token=new-token`;
  getBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
  getMetadata.mockResolvedValue({ contentType: 'image/jpeg' });
  deleteObject.mockResolvedValue(undefined);
  uploadBytes.mockResolvedValue(undefined);
  getDownloadURL.mockResolvedValue(newUrl);

  // When: the image capability is rotated.
  const replacements = await rotateStorageDownloadTokens({
    urls: [oldUrl],
    storage: { name: 'storage' },
  });

  // Then: a private copy is created before the original object is touched.
  expect(deleteObject).not.toHaveBeenCalled();
  expect(uploadBytes).toHaveBeenCalledWith(
    expect.objectContaining({ path: expect.stringContaining('post-images/blog/post-a/private-') }),
    expect.any(Uint8Array),
    expect.objectContaining({ contentType: 'image/jpeg' }),
  );
  expect(replacements).toEqual(new Map([[oldUrl, newUrl]]));
});

test('keeps the original object when private copy creation fails', async () => {
  // Given: readable image bytes followed by a failed private copy upload.
  getBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
  getMetadata.mockResolvedValue({ contentType: 'image/jpeg' });
  deleteObject.mockResolvedValue(undefined);
  uploadBytes.mockRejectedValue(new Error('upload failed'));

  // When: the image capability copy is attempted.
  const rotation = rotateStorageDownloadTokens({
    urls: [imageUrl('image.jpg')],
    storage: { name: 'storage' },
  });

  // Then: the visibility transition fails without deleting the public object.
  await expect(rotation).rejects.toThrow('upload failed');
  expect(deleteObject).not.toHaveBeenCalled();
  expect(getDownloadURL).not.toHaveBeenCalled();
});

test('removes a private copy when download URL creation fails', async () => {
  getBytes.mockResolvedValue(new Uint8Array([1]));
  getMetadata.mockResolvedValue({ contentType: 'image/jpeg' });
  uploadBytes.mockResolvedValue(undefined);
  getDownloadURL.mockRejectedValue(new Error('url failed'));
  deleteObject.mockResolvedValue(undefined);

  await expect(rotateStorageDownloadTokens({
    urls: [imageUrl('image.jpg')],
    storage: { name: 'storage' },
  })).rejects.toThrow('url failed');

  expect(deleteObject).toHaveBeenCalledWith(
    expect.objectContaining({ path: expect.stringContaining('/private-') }),
  );
});

test('rotates only images owned by the current post path', async () => {
  const ownUrl = imageUrl('own.jpg');
  const otherUrl = ownUrl.replace('post-a', 'post-b');
  const privateUrl = imageUrl('private-own.jpg');
  getBytes.mockResolvedValue(new Uint8Array([1]));
  getMetadata.mockResolvedValue({ contentType: 'image/jpeg' });
  uploadBytes.mockResolvedValue(undefined);
  getDownloadURL.mockResolvedValue(privateUrl);

  const result = await preparePrivateImageContent({
    content: `<img src="${ownUrl}"><img src="${otherUrl}">`,
    storage: { name: 'storage' },
    pathPrefixes: ['post-images/blog/post-a'],
    targetPathPrefix: 'post-images/study/post-a',
  });

  expect(uploadBytes).toHaveBeenCalledTimes(1);
  expect(uploadBytes.mock.calls[0][0].path).toContain('post-images/study/post-a/private-');
  expect(result.content).toContain(privateUrl);
  expect(result.content).toContain(otherUrl);
  expect(result.originalUrls).toEqual([ownUrl]);
});
