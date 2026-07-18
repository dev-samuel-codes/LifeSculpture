import { replacePendingImages } from './pendingImages';

test('reports every uploaded image so a later failure can be cleaned up', async () => {
  const uploadImage = jest.fn()
    .mockResolvedValueOnce('https://storage/image-a')
    .mockRejectedValueOnce(new Error('second upload failed'));
  const onUploaded = jest.fn();

  await expect(replacePendingImages({
    content: '<img src="temp-a"><img src="temp-b">',
    pendingImages: [
      { file: { name: 'a.png' }, tempUrl: 'temp-a' },
      { file: { name: 'b.png' }, tempUrl: 'temp-b' },
    ],
    uploadImage,
    category: 'study',
    postId: 'post-a',
    onUploaded,
  })).rejects.toThrow('second upload failed');

  expect(onUploaded).toHaveBeenCalledTimes(1);
  expect(onUploaded).toHaveBeenCalledWith('https://storage/image-a');
});

test('replaces pending image URLs after successful uploads', async () => {
  const uploadImage = jest.fn()
    .mockResolvedValueOnce('https://storage/image-a')
    .mockResolvedValueOnce('https://storage/image-b');

  await expect(replacePendingImages({
    content: '<img src="temp-a"><img src="temp-b">',
    pendingImages: [
      { file: { name: 'a.png' }, tempUrl: 'temp-a' },
      { file: { name: 'b.png' }, tempUrl: 'temp-b' },
    ],
    uploadImage,
    category: 'study',
    postId: 'post-a',
  })).resolves.toBe(
    '<img src="https://storage/image-a"><img src="https://storage/image-b">',
  );
});
