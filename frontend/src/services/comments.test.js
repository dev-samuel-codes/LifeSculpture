import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { deleteCommentTree } from './comments';

jest.mock('../firebase/firebase', () => ({ db: { name: 'test-db' } }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((parent, path) => `${String(parent)}/${path}`),
  deleteDoc: jest.fn(),
  doc: jest.fn((parent, id) => `${String(parent)}/${id}`),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  getCountFromServer: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn((value) => value),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  startAfter: jest.fn(),
  where: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  collection.mockImplementation((parent, path) => `${String(parent)}/${path}`);
  doc.mockImplementation((parent, id) => `${String(parent)}/${id}`);
});

test('deletes nested likes before deleting each comment in the tree', async () => {
  // Given: one reply and likes below both the reply and root comment.
  getDocs
    .mockResolvedValueOnce({ docs: [{ id: 'reply-a' }] })
    .mockResolvedValueOnce({ docs: [{ id: 'reply-like' }] })
    .mockResolvedValueOnce({ docs: [{ id: 'root-like' }] });
  deleteDoc.mockResolvedValue(undefined);

  // When: the root comment tree is deleted.
  await deleteCommentTree({ category: 'blog', postId: 'post-a', commentId: 'root-a' });

  // Then: every like is removed before its parent comment document.
  expect(deleteDoc.mock.calls.map(([reference]) => reference)).toEqual([
    '[object Object]/blog/post-a/comments/reply-a/likes/reply-like',
    '[object Object]/blog/post-a/comments/reply-a',
    '[object Object]/blog/post-a/comments/root-a/likes/root-like',
    '[object Object]/blog/post-a/comments/root-a',
  ]);
});

test('does not delete a comment when nested like cleanup fails', async () => {
  // Given: a root comment whose like deletion fails.
  getDocs
    .mockResolvedValueOnce({ docs: [] })
    .mockResolvedValueOnce({ docs: [{ id: 'root-like' }] });
  deleteDoc.mockRejectedValueOnce(new Error('cleanup failed'));

  // When: the tree deletion reaches the failed cleanup.
  const deletion = deleteCommentTree({
    category: 'blog',
    postId: 'post-a',
    commentId: 'root-a',
  });

  // Then: the failure is propagated and the parent remains addressable for retry.
  await expect(deletion).rejects.toThrow('cleanup failed');
  expect(deleteDoc).toHaveBeenCalledTimes(1);
});
