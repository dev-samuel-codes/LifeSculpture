import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import '../style/Study.css';

const POSTS_PER_PAGE = 6;

/** 상위/하위 구조 */
const TAG_SECTIONS = [
  { title: '개발 · IT', tags: ['Frontend', 'React', 'Next.js', 'Vue', 'Angular', 'Backend', 'Node.js', 'Express', 'Django', 'Spring', 'Database', 'Firebase', 'MySQL', 'MongoDB', 'Git', 'Docker', 'DevOps'] },
  { title: '과학', tags: ['Physics', 'Chemistry', 'Biology', 'Earth Science', 'Astronomy'] },
  { title: '수학', tags: ['Basic Math', 'Algebra', 'Geometry', 'Calculus', 'Statistics', 'Logic'] },
  { title: '인문 · 사회', tags: ['History', 'Philosophy', 'Psychology', 'Sociology', 'Politics', 'Economics'] }
];

// 문자열 정규화(대소문자/기호차 완화)
const norm = (s) =>
  (s || '').toString().toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, ' ').trim();

// 본문에서 #해시태그 추출 → Set(정규화된 태그)
const extractHashtags = (raw) => {
  const text = String(raw || '')
    .replace(/<[^>]+>/g, ' ') // HTML 제거(있다면)
    .replace(/\s+/g, ' ');
  // 해시태그: #다음에 문자/숫자/언더스코어가 이어지는 토큰
  const re = /(^|[^#\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
  const set = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    set.add(norm(m[2]));
  }
  return set;
};

function Study() {
  const { role } = useContext(AuthContext);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI 상태
  const [searchText, setSearchText] = useState('');
  const [selectedParent, setSelectedParent] = useState(null); // 단일 선택
  const [selectedChildren, setSelectedChildren] = useState(new Set()); // 다중 선택
  const [sortKey, setSortKey] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);

  // 데이터 로드
  useEffect(() => {
    const fetchAllPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'study'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setAllPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setError('Failed to load study posts.');
      } finally {
        setLoading(false);
      }
    };
    fetchAllPosts();
  }, []);

  // 선택된 상위의 하위 키워드
  const visibleChildren = useMemo(() => {
    if (!selectedParent) return [];
    const sec = TAG_SECTIONS.find((s) => s.title === selectedParent);
    return sec ? sec.tags : [];
  }, [selectedParent]);

  // 상위 변경 시, 보이지 않는 하위 자동 제거
  useEffect(() => {
    setSelectedChildren((prev) => {
      if (!selectedParent) return new Set();
      const allowed = new Set(visibleChildren);
      const next = new Set();
      prev.forEach((c) => { if (allowed.has(c)) next.add(c); });
      return next;
    });
  }, [selectedParent, visibleChildren]);

  // 필터링 & 정렬
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
      const body = post.content ?? post.body ?? post.text ?? ''; // ← 본문 필드명 다르면 여기만 수정
      const hashSet = extractHashtags(body);

      // 상/하위 규칙
      let hierarchyOk = true;
      if (hasChild) {
        // ✅ 하위가 선택되면: "제목 포함" 또는 "본문 해시태그"에 있으면 OK
        hierarchyOk = [...selectedChildren].some((kw) => {
          const k = norm(kw);
          return titleNorm.includes(k) || hashSet.has(k);
        });
      } else if (hasParent) {
        // 상위만 선택: 그 상위의 하위 키워드가 "제목 포함" 또는 "본문 해시태그"에 있으면 OK
        hierarchyOk = visibleChildren.some((kw) => {
          const k = norm(kw);
          return titleNorm.includes(k) || hashSet.has(k);
        });
      }

      // 검색(제목 기준 유지)
      const searchOk = text.length === 0 ? true : titleNorm.includes(text);

      return hierarchyOk && searchOk;
    };

    let rows = visiblePosts.filter(matches);

    // 정렬
    if (sortKey === 'createdAt_desc') {
      rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    } else if (sortKey === 'views_desc') {
      rows.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else if (sortKey === 'title_asc') {
      rows.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return rows;
  }, [allPosts, searchText, selectedParent, selectedChildren, visibleChildren, sortKey, role]);

  // 페이징
  const totalPages = Math.ceil(filteredAndSorted.length / POSTS_PER_PAGE) || 1;
  const currentPosts = useMemo(() => {
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredAndSorted.slice(start, start + POSTS_PER_PAGE);
  }, [filteredAndSorted, currentPage]);

  // 토글
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
    setCurrentPage(1);
  };

  // 날짜 포맷
  const formatDate = (ts) =>
    ts?.toDate ? new Date(ts.toDate()).toLocaleDateString() : '';

  if (loading) return <div className="container mt-4">Loading study posts...</div>;
  if (error) return <div className="container mt-4 text-danger">Error: {error}</div>;

  return (
    <div className="container mt-4">
      <div className="row g-4">
        {/* 좌측: 상위/하위 필터 */}
        <div className="col-md-3">
          <div className="mb-2">
            <button className="btn btn-sm btn-outline-secondary btn-all-posts" onClick={clearAll}>
              전체 게시물
            </button>
          </div>

          {/* 상위 필터 */}
          <div className="study-filter-section mb-3">
            <div className="study-filter-title">상위 필터</div>
            <div className="d-flex flex-wrap gap-2">
              {TAG_SECTIONS.map((sec) => {
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

          {/* 하위 필터(상위 선택 후 표시) */}
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

        {/* 우측: 콘텐츠 */}
        <div className="col-md-9">
          {/* 툴바 */}
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

          {/* 목록 (카드 레이아웃) */}
          {currentPosts.length === 0 ? (
            <p>게시물을 찾을 수 없습니다.</p>
          ) : (
            <div className="row">
              {currentPosts.map((post) => (
                <div key={post.id} className="col-12 mb-3">
                  <Link to={`/posts/study/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card">
                      <div className="card-body card-row">
                        <div className="card-left">
                          <h5 className="card-title">
                            {post.title}
                            {role === 'admin' && (
                              <span style={{ color: post.isPublic === false ? 'red' : 'green', fontSize: '0.8rem', marginLeft: '8px' }}>
                                {post.isPublic === false ? '(비공개)' : '(공개)'}
                              </span>
                            )}
                          </h5>
                          {/* (옵션) 태그 뱃지 */}
                          <div className="card-tags">
                            {(Array.isArray(post.tags) ? post.tags : []).slice(0, 4).map((tg) => (
                              <span key={tg} className="badge bg-light text-dark border">{tg}</span>
                            ))}
                          </div>
                        </div>
                        <div className="card-right">
                          <div className="meta-date">{formatDate(post.createdAt)}</div>
                          <div style={{ height: 8 }} />
                          <div className="meta-views">Views: {post.viewCount || 0}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* 페이징 */}
          <nav aria-label="Page navigation example" className="mt-4">
            <ul className="d-flex justify-content-center list-unstyled study-pagination">
              <li className={`me-1 ${currentPage === 1 ? 'disabled' : ''}`}>
                <button className="btn btn-secondary" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Previous
                </button>
              </li>
              {[...Array(totalPages)].map((_, i) => (
                <li key={i} className={`me-1 ${currentPage === i + 1 ? 'active' : ''}`}>
                  <button className={`btn ${currentPage === i + 1 ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCurrentPage(i + 1)}>
                    {i + 1}
                  </button>
                </li>
              ))}
              <li className={`${currentPage === totalPages ? 'disabled' : ''}`}>
                <button className="btn btn-primary" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
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

export default Study;
