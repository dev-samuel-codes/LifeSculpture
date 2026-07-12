// PostDetailPage.js
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { storage } from '../firebase/firebase';
import { AuthContext } from '../context/AuthContext';
import CommentsSection from '../components/comments/CommentsSection';
import LoginRequiredPopup from '../components/auth/LoginRequiredPopup';
import LikeButton from '../components/posts/LikeButton';
import { formatDateOnly } from '../utils/date';
import { sanitizeHtml } from '../components/text-editor/utils/content';
import { getContentStyleCssVariables } from '../components/text-editor/utils/contentStyleSettings';
import { usePostContentPresentation } from '../hooks/usePostContentPresentation';
import { deletePostWithStorage } from '../services/postDeletion';
import { transitionPostVisibility } from '../services/postVisibilityTransition';
import {
  getPost,
  hasPostLike,
  setPostLike,
} from '../services/posts';
import '../style/pages/post/PostDetail.css';
import '../style/components/editor/RichText.css';

function PostDetailPage() {
  const { category, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, uid, isAuthenticated } = useContext(AuthContext);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const { renderedContent, tocItems } = usePostContentPresentation(post);

  const isAdmin = role === 'admin';
  const contentStyleVariables = useMemo(
    () => getContentStyleCssVariables(post?.contentStyleSettings),
    [post?.contentStyleSettings],
  );

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const [postData, viewerHasLiked] = await Promise.all([
          getPost({ category, id }),
          isAuthenticated && uid ? hasPostLike({ category, id, uid }) : false,
        ]);
        if (!postData) {
          setError('게시물을 찾을 수 없습니다.');
          return;
        }

        const normalizedPost = {
          viewCount: 0,
          likeCount: 0,
          ...postData,
        };

        setPost(normalizedPost);
        setIsPublic(
          typeof normalizedPost.isPublic === 'boolean' ? normalizedPost.isPublic : true,
        );
        setLikeCount(normalizedPost.likeCount || 0);

        setIsLiked(viewerHasLiked);
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
  const handlePublicToggle = async () => {
    try {
      const nextPost = await transitionPostVisibility({
        category,
        id,
        content: post.content,
        isPublic,
        storage,
        uid,
        role,
        pendingStorageCleanup: post.pendingStorageCleanup,
      });
      setPost((currentPost) => ({
        ...currentPost,
        ...nextPost,
      }));
      setIsPublic(nextPost.isPublic);
    } catch (err) {
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
      const newLikeCount = nextLikedState ? likeCount + 1 : Math.max(likeCount - 1, 0);
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
      await deletePostWithStorage({
        category,
        id,
        post,
        isPublic,
        storage,
        uid,
        role,
        onTombstoned: (tombstonedPost) => {
          setPost((currentPost) => ({ ...currentPost, ...tombstonedPost }));
          setIsPublic(false);
        },
      });

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
          style={contentStyleVariables}
          dangerouslySetInnerHTML={{ __html: renderedContent || sanitizeHtml(post.content) }}
        />

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
