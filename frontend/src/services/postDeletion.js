import { deleteStorageImages, getOwnedStorageImageUrls } from '../utils/storage';
import {
  assertPostDeletionFitsBatch,
  completePostDeletionJob,
  deletePost,
  listPostDeletionJobs,
  setPostVisibility,
} from './posts';

const uniqueStrings = (value) => Array.isArray(value)
  ? [...new Set(value.filter((item) => typeof item === 'string' && item))]
  : [];

export async function deletePostWithStorage({
  category,
  id,
  post,
  isPublic,
  storage,
  uid,
  role,
  onTombstoned,
  onDeleted,
}) {
  const currentPathPrefix = `post-images/${category}/${id}`;
  const pathPrefixes = [...new Set([
    currentPathPrefix,
    ...uniqueStrings(post.storagePathPrefixes),
    ...uniqueStrings(post.pendingStorageCleanup?.pathPrefixes),
  ])];
  const imageUrls = [...new Set([
    ...getOwnedStorageImageUrls({ content: post.content, pathPrefixes }),
    ...uniqueStrings(post.pendingStorageCleanup?.urls),
  ])];

  await assertPostDeletionFitsBatch({ category, id });

  let visibilityLocked = false;
  if (isPublic) {
    await setPostVisibility({ category, id, isPublic: false });
    visibilityLocked = true;
    onTombstoned?.({ ...post, isPublic: false });
  }

  let jobId;
  try {
    ({ jobId } = await deletePost({
      category,
      id,
      storageCleanup: { urls: imageUrls, pathPrefixes },
    }));
  } catch (error) {
    if (visibilityLocked) {
      try {
        await setPostVisibility({ category, id, isPublic: true });
      } catch (restoreError) {
        error.visibilityRestoreFailed = true;
      }
    }
    throw error;
  }

  onDeleted?.();
  try {
    await deleteStorageImages({
      urls: imageUrls,
      storage,
      uid,
      role,
      pathPrefixes,
    });
    await completePostDeletionJob({ jobId });
    return { storageCleanupPending: false };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('게시물 삭제 후 이미지 정리를 다음 관리자 접속으로 연기합니다.', error);
    }
    return { storageCleanupPending: true };
  }
}

export async function retryPendingPostDeletionCleanups({ storage, uid, role }) {
  if (!uid || role !== 'admin') return { completed: 0, pending: 0 };

  const jobs = await listPostDeletionJobs();
  let completed = 0;
  let pending = 0;
  for (const job of jobs) {
    try {
      await deleteStorageImages({
        urls: uniqueStrings(job.urls),
        storage,
        uid,
        role,
        pathPrefixes: uniqueStrings(job.pathPrefixes),
      });
      await completePostDeletionJob({ jobId: job.id });
      completed += 1;
    } catch (error) {
      pending += 1;
    }
  }
  return { completed, pending };
}
