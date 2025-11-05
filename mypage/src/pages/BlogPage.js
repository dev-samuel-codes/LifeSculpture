import React, { useState, useEffect, useMemo, useContext } from 'react';
import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import { formatDate } from '../utils/date';
import '../style/Study.css'; // 스타일 재사용

const POSTS_PER_PAGE = 6;

const BLOG_SECTIONS = [
  { title: '에세이 · 일상', tags: ['일상', '생각', '회고', '일기'] },
  { title: '여행', tags: ['여행', '국내여행', '해외여행', '일정', '후기'] },
  { title: '사진', tags: ['사진', '포토', '촬영', '카메라'] },
  { title: '튜토리얼 · 팁', tags: ['팁', '가이드', '튜토리얼', '노하우', '설정'] },
  { title: '리뷰', tags: ['리뷰', '사용기', '언박싱'] },
  { title: '개발 블로그', tags: ['개발', 'React', 'Next.js', 'Node', 'Firebase'] },
];

const norm = (s) =>
  (s || '').toString().toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, ' ').trim();

const extractHashtags = (raw) => {
  const text = String(raw || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const re = /(^|[^#\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
  const set = new Set();
  let m;
  while ((m = re.exec(text)) !== null) set.add(norm(m[2]));
  return set;
};


function BlogPage() {
  const { role } = useContext(AuthContext);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchText, setSearchText] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedChildren, setSelectedChildren] = useState(new Set());
  const [sortKey, setSortKey] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchAllPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'blog'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.log('[Blog] 로드된 게시물 수:', posts.length);
        console.log('[Blog] 게시물 데이터:', posts);
        setAllPosts(posts);
      } catch (e) {
        console.error('[Blog] 게시물 로드 실패:', e);
        setError('Failed to load blog posts.');
      } finally {
        setLoading(false);
      }
    };
    fetchAllPosts();
  }, []);

  const visibleChildren = useMemo(() => {
    if (!selectedParent) return [];
    const sec = BLOG_SECTIONS.find((s) => s.title === selectedParent);
    return sec ? sec.tags : [];
  }, [selectedParent]);

  // 상위 변경 시, 보이지 않는 하위 자동 정리
  useEffect(() => {
    setSelectedChildren((prev) => {
      if (!selectedParent) return new Set();
      const allowed = new Set(visibleChildren);
      const next = new Set();
      prev.forEach((c) => { if (allowed.has(c)) next.add(c); });
      return next;
    });
  }, [selectedParent, visibleChildren]);

  const filteredAndSorted = useMemo(() => {
    const visiblePosts = allPosts.filter(post => {
      const isPostPublic = post.isPublic !== false;
      return role === 'admin' || isPostPublic;
    });

    const text = norm(searchText);
    const hasParent = !!selectedParent;
    const hasChild = selectedChildren.size > 0;

    const matches = (post) => {
      const titleNorm = norm(post.title);
      const body = post.content ?? post.body ?? post.text ?? ''; // ← 블로그 본문 키 확인
      const hashSet = extractHashtags(body);

      let hierarchyOk = true;
      if (hasChild) {
        // ✅ 하위 선택 시: "제목 포함" 또는 "본문 해시태그"에 있으면 OK
        hierarchyOk = [...selectedChildren].some((kw) => {
          const k = norm(kw);
          return titleNorm.includes(k) || hashSet.has(k);
        });
      } else if (hasParent) {
        // 상위만 선택 시: 해당 카테고리의 키워드가 제목 또는 해시태그에 존재하면 OK
        hierarchyOk = visibleChildren.some((kw) => {
          const k = norm(kw);
          return titleNorm.includes(k) || hashSet.has(k);
        });
      }

      const searchOk = text.length === 0 ? true : titleNorm.includes(text);
      return hierarchyOk && searchOk;
    };

    let rows = visiblePosts.filter(matches);

    if (sortKey === 'createdAt_desc') {
      rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    } else if (sortKey === 'views_desc') {
      rows.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else if (sortKey === 'title_asc') {
      rows.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return rows;
  }, [allPosts, searchText, selectedParent, selectedChildren, visibleChildren, sortKey, role]);

  const totalPages = Math.ceil(filteredAndSorted.length / POSTS_PER_PAGE) || 1;
  const currentPosts = useMemo(() => {
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredAndSorted.slice(start, start + POSTS_PER_PAGE);
  }, [filteredAndSorted, currentPage]);

  const toggleParent = (title) => {
    setCurrentPage(1);
    setSelectedParent((prev) => (prev === title ? null : title));
  };

  const toggleChild = (tag) => {
    setCurrentPage(1);
    setSelectedChildren((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const clearAll = () => {
    setSelectedParent(null);
    setSelectedChildren(new Set());
    setSearchText('');
    setSortKey('createdAt_desc');
    setCurrentPage(1);
  };

  if (loading) return <div className="container mt-4">Loading blog posts...</div>;
  if (error) return <div className="container mt-4 text-danger">Error: {error}</div>;

  return (
    <div className="container mt-4">
      <div className="row g-4">
        {/* 좌측 필터 */}
        <div className="col-md-3">
          <div className="mb-2">
            <button className="btn btn-sm btn-outline-secondary btn-all-posts" onClick={clearAll}>
              전체 게시물
            </button>
          </div>

          <div className="study-filter-section mb-3">
            <div className="study-filter-title">상위 필터</div>
            <div className="d-flex flex-wrap gap-2">
              {BLOG_SECTIONS.map((sec) => {
                const active = selectedParent === sec.title;
                return (
                  <button
                    key={sec.title}
                    type="button"
                    className={`parent-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleParent(sec.title)}
                  >
                    {sec.title}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedParent && (
            <div className="study-filter-section mb-3">
              <div className="study-filter-title">하위 필터</div>
              <div className="d-flex flex-wrap gap-2">
                {visibleChildren.map((t) => {
                  const active = selectedChildren.has(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`child-chip ${active ? 'active' : ''}`}
                      onClick={() => toggleChild(t)}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 우측 리스트 */}
        <div className="col-md-9">
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3 study-toolbar">
            <input
              className="form-control"
              style={{ maxWidth: 360 }}
              placeholder="검색어를 입력하세요 (제목에 포함)"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
            />
            <select
              className="form-select"
              style={{ maxWidth: 200 }}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              <option value="createdAt_desc">최신순</option>
              <option value="views_desc">조회수순</option>
              <option value="title_asc">제목 A→Z</option>
            </select>
            <div className="ms-auto small text-muted">
              총 {filteredAndSorted.length}개 결과
            </div>
          </div>

          {/* 카드 레이아웃 적용 */}
          {currentPosts.length === 0 ? (
            <p>게시물을 찾을 수 없습니다.</p>
          ) : (
            <div className="row">
              {currentPosts.map((post) => {
                return (
                  <div key={post.id} className="col-12 mb-3">
                    <div 
                      className="card clickable-card"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        console.log('[Blog] 게시물 클릭:', { id: post.id, title: post.title, path: `/posts/blog/${post.id}` });
                        // 데스크탑 환경에서 링크 클릭 문제 해결
                        window.location.href = `/posts/blog/${post.id}`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          window.location.href = `/posts/blog/${post.id}`;
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${post.title} 게시물 보기`}
                    >
                      <div className="card-body card-row">
                        <div className="card-left">
                          <div className="clickable-card-content">
                            <h5 className="card-title">
                              {post.title}
                              {role === 'admin' && (
                                <span
                                  className="emoji-lock"
                                  style={{ fontSize: '0.8rem', marginLeft: '8px' }}
                                  role="img"
                                  aria-label={post.isPublic === false ? '비공개' : '공개'}
                                >
                                  {post.isPublic === false ? '🔒️' : '🔓️'}
                                </span>
                              )}
                            </h5>
                            <div className="card-tags">
                              {(Array.isArray(post.tags) ? post.tags : []).slice(0, 4).map((tg) => (
                                <span key={tg} className="badge bg-light text-dark border">{tg}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="card-right">
                          <div className="meta-info">
                            <div className="meta-date">{formatDate(post.createdAt)}</div>
                            <div className="meta-views">Views: {post.viewCount || 0}</div>
                          </div>
                          <div className="like-section">
                            <div className="heart-icon">
                              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                              </svg>
                            </div>
                            <span className="like-count">{post.likeCount || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <nav aria-label="Page navigation example" className="mt-4">
            <ul className="d-flex justify-content-center list-unstyled study-pagination">
              <li className={`me-1 ${currentPage === 1 ? 'disabled' : ''}`}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
              </li>

              {[...Array(totalPages)].map((_, i) => (
                <li key={i} className={`me-1 ${currentPage === i + 1 ? 'active' : ''}`}>
                  <button
                    className={`btn ${currentPage === i + 1 ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}

              <li className={`${currentPage === totalPages ? 'disabled' : ''}`}>
                <button
                  className="btn btn-primary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default BlogPage;
