import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listPostsPage } from '../services/posts';
import { extractHashtagsFromContent } from '../utils/tags';

const POSTS_PER_PAGE_DEFAULT = 6;
const POST_LIST_CACHE_TTL = 60 * 1000;
const EMPTY_SECTIONS = [];

const postListCache = new Map();
const getCacheKey = (collectionName, includePrivate = false) =>
  (collectionName || 'default') + ':' + (includePrivate ? 'all' : 'public');
const readCache = (collectionName, includePrivate) =>
  postListCache.get(getCacheKey(collectionName, includePrivate));

export const invalidatePostListCache = (collectionNames = []) => {
  if (!Array.isArray(collectionNames) || collectionNames.length === 0) {
    postListCache.clear();
    return;
  }

  collectionNames.forEach((collectionName) => {
    postListCache.delete(getCacheKey(collectionName, false));
    postListCache.delete(getCacheKey(collectionName, true));
  });
};

const norm = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim();

const ensureArray = (value) => (Array.isArray(value) ? value : []);

function usePostList({
  collectionName,
  sections = EMPTY_SECTIONS,
  role,
  postsPerPage = POSTS_PER_PAGE_DEFAULT,
}) {
  const includePrivate = role === 'admin';
  const initialCache = readCache(collectionName, includePrivate);
  const [allPosts, setAllPosts] = useState(() => initialCache?.posts ?? []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(() => initialCache?.hasMore ?? false);
  const [isFullyLoaded, setIsFullyLoaded] = useState(() => initialCache?.isFullyLoaded ?? false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedChildren, setSelectedChildren] = useState(new Set());
  const [sortKey, setSortKey] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);

  const initialLoadRef = useRef(0);
  const cursorRef = useRef(initialCache?.cursor ?? null);
  const fetchingMoreRef = useRef(false);

  const updateCache = useCallback(
    (posts, nextCursor, nextHasMore, fullyLoaded) => {
      postListCache.set(getCacheKey(collectionName, includePrivate), {
        posts,
        cursor: nextCursor,
        hasMore: nextHasMore,
        isFullyLoaded: fullyLoaded,
        timestamp: Date.now(),
      });
    },
    [collectionName, includePrivate],
  );

  const appendPosts = useCallback(
    (posts, nextCursor, nextHasMore) => {
      setAllPosts((prev) => {
        const merged = [...prev, ...posts];
        updateCache(merged, nextCursor, nextHasMore, !nextHasMore);
        return merged;
      });
      cursorRef.current = nextCursor;
      setHasMore(nextHasMore);
      if (!nextHasMore) {
        setIsFullyLoaded(true);
      }
    },
    [updateCache],
  );

  const fetchInitialPosts = useCallback(async ({ silent = false } = {}) => {
    initialLoadRef.current += 1;
    const loadId = initialLoadRef.current;
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    if (!silent) {
      setAllPosts([]);
      cursorRef.current = null;
      setHasMore(false);
      setIsFullyLoaded(false);
    }

    try {
      const { posts, cursor: nextCursor, hasMore: nextHasMore } = await listPostsPage({
        category: collectionName,
        includePrivate,
        limit: postsPerPage,
      });
      if (initialLoadRef.current === loadId) {
        setAllPosts(posts);
        cursorRef.current = nextCursor;
        setHasMore(nextHasMore);
        const fullyLoaded = !nextHasMore;
        setIsFullyLoaded(fullyLoaded);
        updateCache(posts, nextCursor, nextHasMore, fullyLoaded);
      }
    } catch (err) {
      console.error('[usePostList] 초기 게시글 로드 실패:', err);
      if (initialLoadRef.current === loadId && !silent) {
        setError('게시글을 불러오지 못했습니다.');
        setAllPosts([]);
      }
    } finally {
      if (initialLoadRef.current === loadId && !silent) {
        setLoading(false);
      }
    }
  }, [collectionName, includePrivate, postsPerPage, updateCache]);

  useEffect(() => {
    const cached = readCache(collectionName, includePrivate);
    if (cached) {
      setAllPosts(cached.posts);
      cursorRef.current = cached.cursor ?? null;
      setHasMore(cached.hasMore ?? false);
      setIsFullyLoaded(cached.isFullyLoaded ?? false);
      setLoading(false);
      setError(null);
      return;
    }

    setAllPosts([]);
    cursorRef.current = null;
    setHasMore(false);
    setIsFullyLoaded(false);
    setLoading(true);
    setError(null);
  }, [collectionName, includePrivate]);

  useEffect(() => {
    const cached = readCache(collectionName, includePrivate);
    const isStale = !cached || Date.now() - cached.timestamp > POST_LIST_CACHE_TTL;
    if (isStale) {
      fetchInitialPosts({ silent: Boolean(cached) });
    }
  }, [collectionName, fetchInitialPosts, includePrivate]);

  const fetchMorePosts = useCallback(async () => {
    const currentCursor = cursorRef.current;
    if (fetchingMoreRef.current || !hasMore || !currentCursor) {
      if (!hasMore) {
        setIsFullyLoaded(true);
      }
      return { loaded: false, hasMore };
    }

    fetchingMoreRef.current = true;
    setIsFetchingMore(true);
    try {
      const { posts, cursor: nextCursor, hasMore: nextHasMore } = await listPostsPage({
        category: collectionName,
        includePrivate,
        limit: postsPerPage,
        cursor: currentCursor,
      });
      appendPosts(posts, nextCursor, nextHasMore);
      return { loaded: posts.length > 0, hasMore: nextHasMore };
    } catch (err) {
      console.error('[usePostList] 추가 게시글 로드 실패:', err);
      return { loaded: false, hasMore };
    } finally {
      fetchingMoreRef.current = false;
      setIsFetchingMore(false);
    }
  }, [appendPosts, collectionName, hasMore, includePrivate, postsPerPage]);

  const fetchAllRemaining = useCallback(async () => {
    if (isFullyLoaded) return;
    let more = true;
    while (more) {
      const result = await fetchMorePosts();
      if (!result.loaded) break;
      more = result.hasMore;
    }
  }, [fetchMorePosts, isFullyLoaded]);

  useEffect(() => {
    setSearchText('');
    setSelectedParent(null);
    setSelectedChildren(new Set());
    setSortKey('createdAt_desc');
    setCurrentPage(1);
  }, [collectionName]);

  const visibleChildren = useMemo(() => {
    if (!selectedParent) return [];
    const section = sections.find((item) => item.title === selectedParent);
    return section ? ensureArray(section.tags) : [];
  }, [selectedParent, sections]);

  useEffect(() => {
    if (!selectedParent) return;
    const isValid = sections.some((section) => section.title === selectedParent);
    if (!isValid) {
      setSelectedParent(null);
      setSelectedChildren(new Set());
    }
  }, [sections, selectedParent]);

  useEffect(() => {
    setSelectedChildren((prev) => {
      if (!selectedParent) return new Set();
      const allowed = new Set(visibleChildren);
      const next = new Set();
      prev.forEach((child) => {
        if (allowed.has(child)) next.add(child);
      });
      return next;
    });
  }, [selectedParent, visibleChildren]);

  useEffect(() => {
    if (isFullyLoaded) return;
    const requiresFullData =
      searchText.trim().length > 0 ||
      Boolean(selectedParent) ||
      selectedChildren.size > 0 ||
      sortKey !== 'createdAt_desc';
    if (requiresFullData) {
      fetchAllRemaining();
    }
  }, [fetchAllRemaining, isFullyLoaded, searchText, selectedChildren, selectedParent, sortKey]);

  useEffect(() => {
    if (!hasMore) return;
    const requiredCount = currentPage * postsPerPage;
    if (requiredCount <= allPosts.length || isFetchingMore || loading) return;
    fetchMorePosts();
  }, [allPosts.length, currentPage, fetchMorePosts, hasMore, isFetchingMore, loading, postsPerPage]);

  const filteredPosts = useMemo(() => {
    const text = norm(searchText);
    const hasParent = Boolean(selectedParent);
    const hasChild = selectedChildren.size > 0;

    const visiblePosts = allPosts.filter((post) => {
      const isPostPublic = post.isPublic !== false;
      return role === 'admin' || isPostPublic;
    });

    const matchesHierarchy = (post) => {
      const titleNorm = norm(post.title);
      const tagSet = (() => {
        const tags = Array.isArray(post.tags) ? post.tags : [];
        if (tags.length > 0) {
          return new Set(tags.map((tag) => norm(tag)));
        }
        const body = post.content ?? post.body ?? post.text ?? '';
        if (!body) return new Set();
        return new Set(extractHashtagsFromContent(body).map((tag) => norm(tag)));
      })();

      if (hasChild) {
        return [...selectedChildren].some((keyword) => {
          const normalized = norm(keyword);
          return titleNorm.includes(normalized) || tagSet.has(normalized);
        });
      }

      if (hasParent) {
        return visibleChildren.some((keyword) => {
          const normalized = norm(keyword);
          return titleNorm.includes(normalized) || tagSet.has(normalized);
        });
      }

      return true;
    };

    const matchesSearch = (post) => {
      if (!text.length) return true;
      const titleNorm = norm(post.title);
      return titleNorm.includes(text);
    };

    const rows = visiblePosts.filter((post) => matchesHierarchy(post) && matchesSearch(post));

    if (sortKey === 'createdAt_desc') {
      rows.sort(
        (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
      );
    } else if (sortKey === 'views_desc') {
      rows.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else if (sortKey === 'title_asc') {
      rows.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return rows;
  }, [
    allPosts,
    role,
    searchText,
    selectedParent,
    selectedChildren,
    sortKey,
    visibleChildren,
  ]);

  const loadedPageCount = Math.ceil(filteredPosts.length / postsPerPage) || 1;
  const totalPages = loadedPageCount + (hasMore ? 1 : 0);

  const currentPosts = useMemo(() => {
    const start = (currentPage - 1) * postsPerPage;
    return filteredPosts.slice(start, start + postsPerPage);
  }, [filteredPosts, currentPage, postsPerPage]);

  const handleSearchChange = useCallback((value) => {
    setSearchText(value);
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((value) => {
    setSortKey(value);
    setCurrentPage(1);
  }, []);

  const toggleParent = useCallback((title) => {
    setCurrentPage(1);
    setSelectedParent((prev) => (prev === title ? null : title));
  }, []);

  const toggleChild = useCallback((tag) => {
    setCurrentPage(1);
    setSelectedChildren((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelectedParent(null);
    setSelectedChildren(new Set());
    setSearchText('');
    setSortKey('createdAt_desc');
    setCurrentPage(1);
  }, []);

  const goToPage = useCallback(async (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    if (pageNumber > loadedPageCount) {
      const result = await fetchMorePosts();
      if (!result.loaded) return;
    }
    setCurrentPage(pageNumber);
  }, [fetchMorePosts, loadedPageCount, totalPages]);

  const goToPrevious = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNext = useCallback(
    () => goToPage(Math.min(totalPages, currentPage + 1)),
    [currentPage, goToPage, totalPages],
  );

  return {
    loading,
    error,
    searchText,
    sortKey,
    selectedParent,
    selectedChildren,
    visibleChildren,
    currentPage,
    totalPages,
    filteredCount: filteredPosts.length,
    currentPosts,
    handleSearchChange,
    handleSortChange,
    toggleParent,
    toggleChild,
    clearAll,
    goToPage,
    goToPrevious,
    goToNext,
  };
}

export default usePostList;
