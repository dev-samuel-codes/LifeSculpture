// PostDetailPage.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { storage } from '../firebase/firebase';
import { AuthContext } from '../context/AuthContext';
import { CommentsSection, LazyImage, LoginRequiredPopup, LikeButton } from '../components';
import { formatDateOnly } from '../utils/date';
import { extractImageUrls } from '../components/text-editor/utils/media';
import { setupResponsiveImageSizing } from '../components/text-editor/utils/imageSizing';
import { deleteStorageImages } from '../utils/storage';
import {
  deletePost as removePost,
  getPost,
  incrementPostView,
  setPostLike,
  setPostVisibility,
} from '../services/posts';
import '../style/pages/post/PostDetail.css';
import '../style/components/editor/RichText.css';

const enhanceCodeBlocks = (html) => {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof document === 'undefined') return html;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  const containers = wrapper.querySelectorAll('.ql-code-block-container');

  containers.forEach((container) => {
    if (!container.classList.contains('has-separated-header')) {
      if (!container.querySelector('.code-block-header')) {
        const header = document.createElement('div');
        header.className = 'code-block-header';

        const indicators = document.createElement('div');
        indicators.className = 'code-block-indicators';

        ['red', 'yellow', 'green'].forEach((color) => {
          const indicator = document.createElement('span');
          indicator.className = `code-block-indicator ${color}`;
          indicators.appendChild(indicator);
        });

        header.appendChild(indicators);
        container.insertBefore(header, container.firstChild);
      }

      let body = container.querySelector('.code-block-body');

      if (!body) {
        body = document.createElement('div');
        body.className = 'code-block-body';

        while (container.children.length > 1) {
          body.appendChild(container.children[1]);
        }

        container.appendChild(body);
      }

      const preElements = body.querySelectorAll('pre');

      preElements.forEach((pre) => {
        if (pre.dataset.lineNumbered === 'true') {
          return;
        }

        const textContent = pre.textContent || '';
        const normalized = textContent.replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');

        if (lines.length > 1 && lines[lines.length - 1] === '') {
          lines.pop();
        }

        const codeElement = document.createElement('code');

        lines.forEach((line, index) => {
          const lineSpan = document.createElement('span');

          lineSpan.textContent = line.length === 0 ? '\u00A0' : line;
          const lineNumber = String(index + 1);
          lineSpan.dataset.lineNumber = lineNumber;
          lineSpan.setAttribute('data-line-number', lineNumber);

          codeElement.appendChild(lineSpan);
        });

        if (lines.length === 0) {
          const placeholderLine = document.createElement('span');
          placeholderLine.textContent = '\u00A0';
          placeholderLine.dataset.lineNumber = '1';
          placeholderLine.setAttribute('data-line-number', '1');
          codeElement.appendChild(placeholderLine);
        }

        pre.innerHTML = '';
        pre.appendChild(codeElement);
        pre.dataset.lineNumbered = 'true';
      });

      container.classList.add('has-separated-header');
    }
  });

  return wrapper.innerHTML;
};

const buildContentWithToc = (html) => {
  if (!html) {
    return { html: '', toc: [] };
  }

  const enhancedHtml = enhanceCodeBlocks(html);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { html: enhancedHtml, toc: [] };
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = enhancedHtml;

  const idCounts = {};
  const headings = wrapper.querySelectorAll('h1, h2, h3, h4, h5, h6');

  const tocItems = Array.from(headings)
    .filter((heading) => heading.textContent && heading.textContent.trim().length > 0)
    .map((heading, index) => {
      const text = heading.textContent.trim();
      const normalizedBase = text
        .toLowerCase()
        .replace(/[^0-9a-zA-Z\u3131-\u318E\uAC00-\uD7A3\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      const baseId = normalizedBase || `heading-${index + 1}`;
      const count = idCounts[baseId] || 0;
      idCounts[baseId] = count + 1;
      const uniqueId = count === 0 ? baseId : `${baseId}-${count}`;

      heading.id = uniqueId;

      return {
        id: uniqueId,
        text,
        level: Number(heading.tagName.replace('H', '')) || 2,
      };
    });

  return { html: wrapper.innerHTML, toc: tocItems };
};

function PostDetailPage() {
  const { category, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, uid, isAuthenticated } = useContext(AuthContext);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [renderedContent, setRenderedContent] = useState('');
  const [tocItems, setTocItems] = useState([]);
  const viewCountIncremented = useRef(false);

  const isAdmin = role === 'admin';

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postData = await getPost({ category, id });
        if (!postData) {
          setError('게시물을 찾을 수 없습니다.');
          return;
        }

        const normalizedPost = {
          viewCount: 0,
          likeCount: 0,
          likedBy: [],
          ...postData,
        };

        setPost(normalizedPost);
        setIsPublic(
          typeof normalizedPost.isPublic === 'boolean' ? normalizedPost.isPublic : true,
        );
        setLikeCount(normalizedPost.likeCount || 0);

        if (isAuthenticated && uid && normalizedPost.likedBy.includes(uid)) {
          setIsLiked(true);
        }
      } catch (err) {
        setError('게시물을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [category, id, isAuthenticated, uid]);

  useEffect(() => {
    if (!location.state?.refresh) return;
    navigate(location.pathname, { replace: true, state: {} });
    window.location.reload();
  }, [location, navigate]);

  useEffect(() => {
    if (!post || !post.id || isAdmin || viewCountIncremented.current) return;

    const incrementViewCount = async () => {
      try {
        await incrementPostView({ category, id });
        setPost((prev) => ({
          ...prev,
          viewCount: (prev?.viewCount || 0) + 1,
        }));
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('조회수 증가에 실패했습니다:', err);
        }
      } finally {
        viewCountIncremented.current = true;
      }
    };

    incrementViewCount();
  }, [post, category, id, isAdmin]);

  useEffect(() => {
    if (!post?.content) {
      setRenderedContent('');
      setTocItems([]);
      return;
    }

    const { html, toc } = buildContentWithToc(post.content);
    setRenderedContent(html);
    setTocItems(toc);
  }, [post?.content]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const contentEl = document.querySelector('.post-content');
      if (!contentEl) return;

      const codeBlocks = contentEl.querySelectorAll('pre');

      codeBlocks.forEach((block) => {
        block.style.setProperty('white-space', 'pre', 'important');
        block.style.setProperty('overflow-x', 'auto', 'important');
        block.style.setProperty('max-width', '800px', 'important');
        block.style.setProperty('margin', '1.75rem auto', 'important');
        block.style.setProperty('padding', '1.5rem', 'important');
        block.style.setProperty('background-color', '#1a1f2a', 'important');
        block.style.setProperty('border-radius', '14px', 'important');
        block.style.setProperty('color', '#cfd2d1', 'important');

        const container = block.closest('.ql-code-block-container');
        if (container) {
          container.style.setProperty('background-color', 'transparent', 'important');
          container.style.setProperty('padding', '0', 'important');
          container.style.setProperty('border', 'none', 'important');
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [renderedContent]);

  useEffect(() => {
    const contentElement = document.querySelector('.post-content');
    if (!contentElement) return;

    const handleContentClick = (event) => {
      if (event.target.tagName === 'IMG') {
        setSelectedImage(event.target.src);
      }
    };

    contentElement.addEventListener('click', handleContentClick);
    return () => contentElement.removeEventListener('click', handleContentClick);
  }, [renderedContent]);

  useEffect(() => {
    const contentElement = document.querySelector('.post-content');
    if (!contentElement) return undefined;

    return setupResponsiveImageSizing({ root: contentElement });
  }, [renderedContent]);

  useEffect(() => {
    if (!selectedImage) return undefined;
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setSelectedImage(null);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [selectedImage]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640 || !post?.content) return;
      const contentElement = document.querySelector('.post-content');
      if (!contentElement) return;

      const paragraphs = contentElement.querySelectorAll('p');
      paragraphs.forEach((p) => {
        if (p.classList.contains('ql-align-justify')) {
          p.style.textAlign = 'left';
        }
        p.style.wordSpacing = 'normal';
        p.style.letterSpacing = 'normal';
      });

      const justifyElements = contentElement.querySelectorAll('.ql-align-justify');
      justifyElements.forEach((element) => {
        element.style.textAlign = 'left';
        element.style.wordSpacing = 'normal';
        element.style.letterSpacing = 'normal';
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [post]);

  const handlePublicToggle = async () => {
    const nextPublicState = !isPublic;
    setIsPublic(nextPublicState);
    try {
      await setPostVisibility({ category, id, isPublic: nextPublicState });
    } catch (err) {
      setIsPublic(!nextPublicState);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('게시물 공개 상태 업데이트 실패:', err);
      }
    }
  };

  const closeLoginPopup = () => {
    setShowLoginPopup(false);
  };

  const handleLikeClick = async () => {
    if (!isAuthenticated) {
      setShowLoginPopup(true);
      return;
    }

    try {
      const nextLikedState = !isLiked;
      const newLikeCount = nextLikedState ? likeCount + 1 : likeCount - 1;
      await setPostLike({ category, id, uid, like: nextLikedState });
      setIsLiked(nextLikedState);
      setLikeCount(newLikeCount);
    } catch (err) {
      alert('공감 상태를 업데이트하는 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?\n게시물에 포함된 이미지도 함께 삭제됩니다.')) return;

    try {
      const imageUrls = extractImageUrls(post.content);
      await removePost({ category, id });

      if (imageUrls.length > 0) {
        await deleteStorageImages({ urls: imageUrls, storage, uid, role });
      }

      alert('게시물과 관련 이미지가 성공적으로 삭제되었습니다.');
      navigate(`/${category}`);
    } catch (err) {
      alert('게시물을 삭제하는 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div className="post-status">게시물을 불러오는 중...</div>;
  if (error) return <div className="post-status">오류: {error}</div>;
  if (!post) return <div className="post-status">게시물을 찾을 수 없습니다.</div>;

  if (post.isPublic === false && !isAdmin) {
    return <div className="post-status">비공개 게시물입니다.</div>;
  }

  const createdAtText = formatDateOnly(post?.createdAt);
  const likeButtonTitle = isAuthenticated ? (isLiked ? '공감 취소' : '공감하기') : '로그인이 필요합니다';
  const likeButtonAria = likeButtonTitle;
  const handleTocItemClick = (event, targetId) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', `#${targetId}`);
    }
  };

  return (
    <div className="post-detail-layout">
      {tocItems.length > 0 && (
        <aside className="post-toc post-toc--outside">
          <div className="post-toc__title">목차</div>
          <ul className="post-toc__list">
            {tocItems.map(({ id, text, level }) => (
              <li className={`post-toc__item level-${level}`} key={id}>
                <a href={`#${id}`} onClick={(event) => handleTocItemClick(event, id)}>
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <article className="post-detail-container">
        <header className="post-header">
          <div className="title-actions-container">
            <div className="left-section">
              <h2 className="post-title">{post.title}</h2>
            </div>

            {!isAdmin && (
              <LikeButton
                isLiked={isLiked}
                likeCount={likeCount}
                onToggle={handleLikeClick}
                title={likeButtonTitle}
                ariaLabel={likeButtonAria}
              />
            )}

            {isAdmin && (
              <div className="admin-actions">
                <div className="public-switch-container">
                  <label className="switch">
                    <input type="checkbox" checked={isPublic} onChange={handlePublicToggle} />
                    <span className="slider round"></span>
                  </label>
                  <span className="public-status">{isPublic ? '공개' : '비공개'}</span>
                </div>
                <div className="edit-delete-buttons">
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={() => window.open(`/edit-post/${category}/${id}`, '_blank')}
                    aria-label="Edit post"
                  >
                    수정
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={handleDelete} aria-label="Delete post">
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="post-meta">
          <div className="meta-left">
            <span>{createdAtText}</span>
            <span>·</span>
            <span>Views: {post.viewCount || 0}</span>
            {isAdmin && (
              <>
                <span>·</span>
                <span>공감: {likeCount}</span>
              </>
            )}
          </div>
        </div>

        <section
          className="post-content rich-text"
          dangerouslySetInnerHTML={{ __html: renderedContent || post.content }}
        />

        {selectedImage && (
          <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
            <div className="image-modal-content" onClick={(event) => event.stopPropagation()}>
              <LazyImage
                src={selectedImage}
                alt="Enlarged"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
              <button
                className="btn btn-light position-absolute top-0 end-0 m-2"
                onClick={() => setSelectedImage(null)}
                style={{ zIndex: 1001 }}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        <CommentsSection category={category} postId={id} />
        <LoginRequiredPopup
          isOpen={showLoginPopup}
          onClose={closeLoginPopup}
          message="공감 기능을 사용하려면 로그인이 필요합니다."
        />
      </article>
    </div>
  );
}

export default PostDetailPage;
