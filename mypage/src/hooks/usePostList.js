import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listPostsPage } from '../services/posts';

const POSTS_PER_PAGE_DEFAULT = 6;
const FETCH_BATCH_SIZE = 24;

const norm = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim();

const extractHashtags = (raw) => {
  const text = String(raw || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const re = /(^|[^#\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
  const set = new Set();
  let match;
  while ((match = re.exec(text)) !== null) {
    set.add(norm(match[2]));
  }
  return set;
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

function usePostList({ collectionName, sections = [], role, postsPerPage = POSTS_PER_PAGE_DEFAULT }) {
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedChildren, setSelectedChildren] = useState(new Set());
  const [sortKey, setSortKey] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);

  const initialLoadRef = useRef(0);
  const cursorRef = useRef(null);

  const appendPosts = useCallback((posts, nextCursor, nextHasMore) => {
    setAllPosts((prev) => [...prev, ...posts]);
    setCursor(nextCursor);
    cursorRef.current = nextCursor;
    setHasMore(nextHasMore);
    if (!nextHasMore) {
      setIsFullyLoaded(true);
    }
  }, []);

  const fetchInitialPosts = useCallback(async () => {
    initialLoadRef.current += 1;
    const loadId = initialLoadRef.current;
    setLoading(true);
    setError(null);
    setAllPosts([]);
    setCursor(null);
    cursorRef.current = null;
    setHasMore(false);
    setIsFullyLoaded(false);

    try {
      const { posts, cursor: nextCursor, hasMore: nextHasMore } = await listPostsPage({
        category: collectionName,
        limit: FETCH_BATCH_SIZE,
      });
      if (initialLoadRef.current === loadId) {
        setAllPosts(posts);
        setCursor(nextCursor);
        cursorRef.current = nextCursor;
        setHasMore(nextHasMore);
        if (!nextHasMore) {
          setIsFullyLoaded(true);
        }
      }
    } catch (err) {
      console.error('[usePostList] 초기 게시글 로드 실패:', err);
      if (initialLoadRef.current === loadId) {
        setError('게시글을 불러오지 못했습니다.');
        setAllPosts([]);
      }
    } finally {
      if (initialLoadRef.current === loadId) {
        setLoading(false);
      }
    }
  }, [collectionName]);

  useEffect(() => {
    fetchInitialPosts();
  }, [fetchInitialPosts]);

  const fetchMorePosts = useCallback(async () => {
    const currentCursor = cursorRef.current;
    if (isFetchingMore || !hasMore || !currentCursor) {
      if (!hasMore) {
        setIsFullyLoaded(true);
      }
      return false;
    }

    setIsFetchingMore(true);
    try {
      const { posts, cursor: nextCursor, hasMore: nextHasMore } = await listPostsPage({
        category: collectionName,
        limit: FETCH_BATCH_SIZE,
        cursor: currentCursor,
      });
      appendPosts(posts, nextCursor, nextHasMore);
      return nextHasMore;
    } catch (err) {
      console.error('[usePostList] 추가 게시글 로드 실패:', err);
      return false;
    } finally {
      setIsFetchingMore(false);
    }
  }, [appendPosts, collectionName, cursor, hasMore, isFetchingMore]);

  const fetchAllRemaining = useCallback(async () => {
    if (isFullyLoaded) return;
    let more = true;
    while (more) {
      const hasNext = await fetchMorePosts();
      more = Boolean(hasNext);
      if (!more) {
        setIsFullyLoaded(true);
      }
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
      const body = post.content ?? post.body ?? post.text ?? '';
      const hashSet = extractHashtags(body);

      if (hasChild) {
        return [...selectedChildren].some((keyword) => {
          const normalized = norm(keyword);
          return titleNorm.includes(normalized) || hashSet.has(normalized);
        });
      }

      if (hasParent) {
        return visibleChildren.some((keyword) => {
          const normalized = norm(keyword);
          return titleNorm.includes(normalized) || hashSet.has(normalized);
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

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage) || 1;

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

  const goToPage = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

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
