import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const POSTS_PER_PAGE_DEFAULT = 6;

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

  const [searchText, setSearchText] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedChildren, setSelectedChildren] = useState(new Set());
  const [sortKey, setSortKey] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let isCancelled = false;
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        if (isCancelled) return;
        const posts = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setAllPosts(posts);
      } catch (err) {
        if (!isCancelled) {
          setError('Failed to load posts.');
          setAllPosts([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchPosts();
    return () => {
      isCancelled = true;
    };
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
