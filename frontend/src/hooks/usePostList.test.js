import { act, renderHook, waitFor } from '@testing-library/react';
import { listPostsPage } from '../services/posts';
import usePostList, { invalidatePostListCache } from './usePostList';

jest.mock('../services/posts', () => ({
  listPostsPage: jest.fn(),
}));

const createPosts = (prefix, count, newestTimestamp = count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    title: `${prefix} ${index}`,
    isPublic: true,
    createdAt: { toMillis: () => newestTimestamp - index },
  }));

beforeEach(() => {
  invalidatePostListCache();
  listPostsPage.mockReset();
});

test('게시글을 6개씩 조회하고 다음 페이지 진입 시 다음 6개를 불러온다', async () => {
  const firstPage = createPosts('first', 6, 12);
  const secondPage = createPosts('second', 6);
  listPostsPage
    .mockResolvedValueOnce({ posts: firstPage, cursor: 'cursor-1', hasMore: true })
    .mockResolvedValueOnce({ posts: secondPage, cursor: 'cursor-2', hasMore: false });

  const { result } = renderHook(() =>
    usePostList({ collectionName: 'study', role: null }),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(listPostsPage).toHaveBeenNthCalledWith(1, {
    category: 'study',
    includePrivate: false,
    limit: 6,
  });
  expect(result.current.currentPosts.map((post) => post.id)).toEqual(
    firstPage.map((post) => post.id),
  );
  expect(result.current.totalPages).toBe(2);

  await act(async () => {
    await result.current.goToNext();
  });

  expect(listPostsPage).toHaveBeenNthCalledWith(2, {
    category: 'study',
    includePrivate: false,
    limit: 6,
    cursor: 'cursor-1',
  });
  expect(result.current.currentPage).toBe(2);
  expect(result.current.currentPosts.map((post) => post.id)).toEqual(
    secondPage.map((post) => post.id),
  );
});

test('다음 조회 결과가 비어 있으면 현재 페이지를 유지한다', async () => {
  const firstPage = createPosts('first', 6);
  listPostsPage
    .mockResolvedValueOnce({ posts: firstPage, cursor: 'cursor-1', hasMore: true })
    .mockResolvedValueOnce({ posts: [], cursor: null, hasMore: false });

  const { result } = renderHook(() =>
    usePostList({ collectionName: 'blog', role: null }),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await result.current.goToNext();
  });

  expect(result.current.currentPage).toBe(1);
  expect(result.current.totalPages).toBe(1);
  expect(result.current.currentPosts).toHaveLength(6);
});
