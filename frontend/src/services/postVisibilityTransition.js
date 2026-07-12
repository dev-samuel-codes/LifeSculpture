import {
  deleteStorageImages,
  preparePrivateImageContent,
} from '../utils/storage';
import { setPostVisibility, updatePostFields } from './posts';

export async function cleanupPendingStorage({
  category,
  id,
  pendingStorageCleanup,
  storage,
  uid,
  role,
}) {
  const urls = pendingStorageCleanup?.urls;
  if (!Array.isArray(urls) || urls.length === 0) return;
  await deleteStorageImages({
    urls,
    storage,
    uid,
    role,
    pathPrefixes: pendingStorageCleanup.pathPrefixes || [],
  });
  await updatePostFields({
    category,
    id,
    data: { pendingStorageCleanup: null },
  });
}

export async function transitionPostVisibility({
  category,
  id,
  content,
  isPublic,
  storage,
  uid,
  role,
  pendingStorageCleanup,
}) {
  const pathPrefixes = [`post-images/${category}/${id}`];
  await cleanupPendingStorage({
    category,
    id,
    pendingStorageCleanup,
    storage,
    uid,
    role,
  });
  const nextPublicState = !isPublic;
  if (nextPublicState) {
    await setPostVisibility({ category, id, isPublic: true });
    return { content, isPublic: true };
  }

  const transition = await preparePrivateImageContent({
    content,
    storage,
    pathPrefixes,
  });
  const cleanupLedger = {
    urls: transition.originalUrls,
    pathPrefixes,
  };
  try {
    await setPostVisibility({
      category,
      id,
      isPublic: false,
      content: transition.content === content ? undefined : transition.content,
      pendingStorageCleanup: cleanupLedger,
    });
  } catch (error) {
    await deleteStorageImages({
      urls: transition.privateUrls,
      storage,
      uid,
      role,
      pathPrefixes,
    });
    throw error;
  }

  try {
    await deleteStorageImages({
      urls: transition.originalUrls,
      storage,
      uid,
      role,
      pathPrefixes,
    });
    await updatePostFields({
      category,
      id,
      data: { pendingStorageCleanup: null },
    });
  } catch (error) {
    await setPostVisibility({
      category,
      id,
      isPublic: true,
      content: transition.content,
    });
    throw error;
  }

  return {
    content: transition.content,
    isPublic: false,
    pendingStorageCleanup: null,
  };
}
