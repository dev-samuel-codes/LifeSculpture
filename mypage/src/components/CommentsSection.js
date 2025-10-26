import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createComment,
  DEFAULT_PAGE_SIZE,
  deleteCommentTree,
  fetchCommentsPage,
  fetchLikeCount,
  fetchReplyCount,
  hasUserLiked,
  likeComment,
  unlikeComment,
} from '../services/comments';
import { AuthContext } from '../context/AuthContext';
import LoginRequiredPopup from './LoginRequiredPopup';
import '../style/Comments.css';

const ANONYMOUS_NAME = '익명 사용자';

const formatDateOnly = (value) => {
  if (!value) return '';
  let date;
  if (value instanceof Date) date = value; else if (value?.toDate) date = value.toDate(); else date = new Date(value);
  if (Number.isNaN(date?.getTime?.())) return '';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

function CommentComposer({ placeholder, onSubmit, disabled = false, rows = 3, submitLabel = '댓글', maxLength = 1000 }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    const t = value.trim();
    if (!t || disabled || submitting) return;
    if (t.length > maxLength) { alert(`내용은 최대 ${maxLength}자까지 작성할 수 있습니다.`); return; }
    try { setSubmitting(true); await onSubmit(t); setValue(''); } finally { setSubmitting(false); }
  };
  return (
    <form className="comment-composer" onSubmit={handleSubmit}>
      <textarea className="comment-input" placeholder={placeholder} value={value} onChange={(e)=>setValue(e.target.value)} rows={rows} maxLength={maxLength} disabled={disabled||submitting} />
      <div className="comment-actions">
        <button type="submit" className="comment-submit-button" disabled={disabled||submitting||!value.trim()}>{submitting ? '작성 중...' : submitLabel}</button>
      </div>
    </form>
  );
}

async function buildViewerMeta(category, postId, commentId, uid){
  const [likeCount, viewerHasLiked, replyCount] = await Promise.all([
    fetchLikeCount({category, postId, commentId}).catch(()=>0),
    uid ? hasUserLiked({category, postId, commentId, uid}).catch(()=>false) : false,
    fetchReplyCount({category, postId, commentId}).catch(()=>0),
  ]);
  return { likeCount, viewerHasLiked, replyCount };
}

async function hydrateComment(raw, category, postId, uid){
  if (!raw) return null;
  const meta = await buildViewerMeta(category, postId, raw.id, uid);
  return { ...raw, ...meta, replies: [], repliesCursor: null, repliesLoading: false, repliesHasMore: false, showReplies: false };
}

function CommentItem({ comment, depth, onToggleLike, onDeleteComment, currentUser }){
  const canDelete = currentUser.isAuthenticated && (currentUser.uid===comment.authorId || currentUser.role==='admin' || (depth===1 && currentUser.uid===comment.parentAuthorId));
  return (
    <div className={`comment-item depth-${depth}`}>
      <div className="comment-meta">
        <div className="comment-author">
          {comment.authorPhoto && (<img className="comment-avatar" src={comment.authorPhoto} alt={comment.authorName||ANONYMOUS_NAME} />)}
          <span className="comment-author-name">{comment.authorName || ANONYMOUS_NAME}</span>
        </div>
        <span className="comment-date">{formatDateOnly(comment.createdAt)}</span>
      </div>
      <div className="comment-body"><pre className="comment-content">{comment.content}</pre></div>
      <div className="comment-toolbar">
        <button type="button" className={`comment-like-button ${comment.viewerHasLiked?'active':''}`} onClick={()=>onToggleLike(comment)}>좋아요 {comment.likeCount}</button>
        {canDelete && (<button type="button" className="comment-action-button" onClick={()=>onDeleteComment(comment)}>삭제</button>)}
      </div>
    </div>
  );
}

const CommentsSection = ({ category, postId }) => {
  const auth = useContext(AuthContext);
  const currentUser = useMemo(()=>({ isAuthenticated: auth?.isAuthenticated??false, uid: auth?.uid??null, name: auth?.userName||ANONYMOUS_NAME, photo: auth?.userPicture??null, role: auth?.role??null }),[auth?.isAuthenticated,auth?.uid,auth?.userName,auth?.userPicture,auth?.role]);

  const [rootComments,setRootComments]=useState([]);
  const [rootCursor,setRootCursor]=useState(null);
  const [hasMoreRoot,setHasMoreRoot]=useState(false);
  const [loading,setLoading]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState(null);
  const [showLoginPopup,setShowLoginPopup]=useState(false);
  const lastCommentRef=useRef(0);

  const fetchRootComments=useCallback(async({reset=false}={})=>{
    if(!category||!postId){ setLoading(false); return; }
    if(reset) setLoading(true); else { if(!hasMoreRoot||loadingMore) return; setLoadingMore(true); }
    try{
      const {comments,cursor,hasMore}=await fetchCommentsPage({category,postId,parentId:null,pageSize:DEFAULT_PAGE_SIZE,order:'desc',cursor:reset?null:rootCursor});
      const hydrated=await Promise.all(comments.map(c=>hydrateComment(c,category,postId,currentUser.uid)));
      setRootComments(prev=>reset?hydrated:[...prev,...hydrated]); setRootCursor(cursor); setHasMoreRoot(hasMore);
    }catch(e){ console.error('[CommentsSection] Failed to load comments:',e); setError('댓글을 불러오는 중 오류가 발생했습니다.'); }
    finally{ setLoading(false); setLoadingMore(false); }
  },[category,postId,rootCursor,hasMoreRoot,loadingMore,currentUser.uid]);

  useEffect(()=>{ if(category && postId){ fetchRootComments({reset:true}); } else { setLoading(false); } },[category, postId]);

  const requestLogin=()=>setShowLoginPopup(true);

  const appendRootComment=(c)=> setRootComments(prev=>[c,...prev]);
  const replaceCommentInLists=(id,updater)=> setRootComments(prev=>prev.map(item=> item.id===id? updater(item): ({...item, replies:item.replies.map(r=> r.id===id? updater(r): r)})));

  const handleSubmitRootComment=async(content)=>{
    if(!currentUser.isAuthenticated) return requestLogin();
    const now=Date.now(); if(now-lastCommentRef.current<2000){ alert('너무 자주 댓글을 작성할 수 없습니다.'); return; } lastCommentRef.current=now;
    const optimisticId=`temp-${now}`;
    const optimistic={ id:optimisticId, authorId:currentUser.uid, authorName:currentUser.name, authorPhoto:currentUser.photo, content, parentId:null, createdAt:new Date(), updatedAt:new Date(), likeCount:0, viewerHasLiked:false, replyCount:0, replies:[], repliesCursor:null, repliesLoading:false, repliesHasMore:false, showReplies:false, isOptimistic:true };
    appendRootComment(optimistic);
    try{
      const created=await createComment({category,postId,content,parentId:null,authorId:currentUser.uid,authorName:currentUser.name,authorPhoto:currentUser.photo});
      const hydrated=await hydrateComment(created,category,postId,currentUser.uid);
      replaceCommentInLists(optimisticId,()=>hydrated);
    }catch(e){ console.error('[CommentsSection] Failed to create comment:',e); setRootComments(prev=>prev.filter(i=>i.id!==optimisticId)); alert('댓글 작성에 실패했습니다.'); }
  };

  const handleToggleLike=async(target)=>{
    if(!currentUser.isAuthenticated) return requestLogin();
    const isReply=!!target.parentId; const parentId=target.parentId; const adjust=(d,l)=> setRootComments(prev=>prev.map(it=>{ if(!isReply&&it.id===target.id) return {...it, likeCount:Math.max(it.likeCount+d,0), viewerHasLiked:l}; if(isReply&&it.id===parentId) return {...it, replies: it.replies.map(r=> r.id===target.id? {...r, likeCount:Math.max(r.likeCount+d,0), viewerHasLiked:l}: r)}; return it; }));
    const was=target.viewerHasLiked; adjust(was?-1:1,!was);
    try{ if(was) await unlikeComment({category,postId,commentId:target.id,uid:currentUser.uid}); else await likeComment({category,postId,commentId:target.id,uid:currentUser.uid}); }
    catch(e){ console.error('[CommentsSection] Failed to toggle like:',e); adjust(was?1:-1,was); alert('좋아요 처리에 실패했습니다.'); }
  };

  const handleDeleteComment=async(comment)=>{
    if(!window.confirm('이 댓글을 정말 삭제하시겠습니까?')) return;
    const isReply=!!comment.parentId; const parentId=comment.parentId; const prev=rootComments;
    if(isReply){ setRootComments(p=>p.map(it=> it.id===parentId? {...it, replies: it.replies.filter(r=> r.id!==comment.id), replyCount: Math.max(it.replyCount-1,0)}: it)); }
    else { setRootComments(p=>p.filter(it=> it.id!==comment.id)); }
    try{ await deleteCommentTree({category,postId,commentId:comment.id}); }
    catch(e){ console.error('[CommentsSection] Failed to delete comment:',e); setRootComments(prev); alert('댓글 삭제에 실패했습니다.'); }
  };

  return (
    <section className="comments-section">
      <header className="comments-header">
        <div className="comments-title-group">
          <h2 className="comments-title">댓글</h2>
          <span className="comments-count">총 {rootComments.length}개</span>
        </div>
      </header>

      <CommentComposer placeholder={currentUser.isAuthenticated?'내용을 입력하세요.':'로그인 후 댓글을 작성할 수 있습니다.'} onSubmit={handleSubmitRootComment} disabled={!currentUser.isAuthenticated} maxLength={2000} />
      {error && <div className="comments-error">{error}</div>}
      {loading && <div className="comments-loading">댓글을 불러오는 중...</div>}

      <div className="comments-list">
        {rootComments.map((c)=>(
          <CommentItem key={c.id} comment={c} depth={0} onToggleLike={handleToggleLike} onDeleteComment={handleDeleteComment} currentUser={currentUser} />
        ))}
      </div>

      {hasMoreRoot && (
        <button type="button" className="comment-action-button link load-more" onClick={()=>fetchRootComments({reset:false})} disabled={loadingMore}>{loadingMore?'불러오는 중...':'더 보기'}</button>
      )}

      <LoginRequiredPopup isOpen={showLoginPopup} onClose={()=>setShowLoginPopup(false)} />
    </section>
  );
};

export default CommentsSection;