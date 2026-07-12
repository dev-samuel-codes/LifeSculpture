import { deleteStorageImages, getOwnedStorageImageUrls } from '../utils/storage';
import { deletePost } from './posts';
import {
  cleanupPendingStorage,
  transitionPostVisibility,
} from './postVisibilityTransition';

export async function deletePostWithStorage({
  category,
  id,
  post,
  isPublic,
  storage,
  uid,
  role,
  onTombstoned,
}) {
  let postToDelete = post;
  if (isPublic) {
    postToDelete = await transitionPostVisibility({
      category,
      id,
      content: post.content,
      isPublic: true,
      storage,
      uid,
      role,
      pendingStorageCleanup: post.pendingStorageCleanup,
    });
    onTombstoned?.(postToDelete);
  } else {
    await cleanupPendingStorage({
      category,
      id,
      pendingStorageCleanup: post.pendingStorageCleanup,
      storage,
      uid,
      role,
    });
  }

  const pathPrefixes = [`post-images/${category}/${id}`];
  const imageUrls = getOwnedStorageImageUrls({
    content: postToDelete.content,
    pathPrefixes,
  });
  await deleteStorageImages({
    urls: imageUrls,
    storage,
    uid,
    role,
    pathPrefixes,
  });
  await deletePost({ category, id });
}
