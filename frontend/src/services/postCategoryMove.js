import {
  collection,
  deleteField,
  doc,
  getDocFromServer,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const POST_CATEGORIES = new Set(['blog', 'study']);
const FIRESTORE_BATCH_WRITE_LIMIT = 500;
const MOVE_STATIC_WRITE_COUNT = 4;
export const MAX_ATOMIC_MOVE_LIKES = Math.floor(
  (FIRESTORE_BATCH_WRITE_LIMIT - MOVE_STATIC_WRITE_COUNT) / 2,
);
const INDEX_FIELDS = ['title', 'tags', 'createdAt', 'viewCount', 'likeCount', 'isPublic'];
const DEFAULT_DEV_BACKEND_URL = 'http://localhost:5000';
const configuredBackendBaseUrl = (process.env.REACT_APP_BACKEND_URL || '').trim().replace(/\/$/, '');
const backendBaseUrl = configuredBackendBaseUrl ||
  (process.env.NODE_ENV === 'development' ? DEFAULT_DEV_BACKEND_URL : '');

const collectionRef = (category) => collection(db, category);
const docRef = (category, id) => doc(collectionRef(category), id);
const indexCollectionRef = (category) => collection(db, 'post_index', category, 'posts');
const indexDocRef = (category, id) => doc(indexCollectionRef(category), id);
const moveJobDocRef = (jobId) => doc(db, 'post_move_jobs', jobId);

const uniqueStrings = (value) => Array.isArray(value)
  ? [...new Set(value.filter((item) => typeof item === 'string' && item))]
  : [];

const buildMovedIndexPayload = (postData = {}, sourceIndexData = {}) => {
  const payload = {};
  INDEX_FIELDS.forEach((field) => {
    if (postData[field] !== undefined) {
      payload[field] = postData[field];
      return;
    }
    if (sourceIndexData[field] !== undefined) payload[field] = sourceIndexData[field];
  });
  if (payload.viewCount === undefined) payload.viewCount = 0;
  if (payload.likeCount === undefined) payload.likeCount = 0;
  if (payload.tags === undefined) payload.tags = [];
  if (payload.isPublic === undefined) payload.isPublic = true;
  return payload;
};

const sanitizePostUpdates = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const allowedKeys = new Set([
    'title',
    'content',
    'tags',
    'isPublic',
    'contentStyleSettings',
    'contentTableSettings',
    'pendingStorageCleanup',
    'storagePathPrefixes',
  ]);
  const updates = {};
  Object.entries(input).forEach(([key, value]) => {
    if (allowedKeys.has(key) && value !== undefined) updates[key] = value;
  });
  return updates;
};

const isValidPostCategory = (category) =>
  typeof category === 'string' && POST_CATEGORIES.has(category.trim());

const normalizeMoveInput = ({ fromCategory, toCategory, id }) => ({
  sourceCategory: typeof fromCategory === 'string' ? fromCategory.trim() : '',
  targetCategory: typeof toCategory === 'string' ? toCategory.trim() : '',
  postId: typeof id === 'string' ? id.trim() : '',
});

const validateMoveInput = ({ sourceCategory, targetCategory, postId }) => {
  if (!postId) throw new Error('postId가 필요합니다.');
  if (!isValidPostCategory(sourceCategory) || !isValidPostCategory(targetCategory)) {
    throw new Error('카테고리가 올바르지 않습니다.');
  }
  if (sourceCategory === targetCategory) {
    throw new Error('같은 카테고리로는 이동할 수 없습니다.');
  }
};

const getMoveJobId = ({ sourceCategory, targetCategory, postId }) =>
  `${sourceCategory}--${targetCategory}--${postId}`;

const getMoveReferences = ({ sourceCategory, targetCategory, postId }) => {
  const jobId = getMoveJobId({ sourceCategory, targetCategory, postId });
  return {
    jobId,
    jobRef: moveJobDocRef(jobId),
    sourcePostRef: docRef(sourceCategory, postId),
    sourceIndexRef: indexDocRef(sourceCategory, postId),
    targetPostRef: docRef(targetCategory, postId),
    targetIndexRef: indexDocRef(targetCategory, postId),
  };
};

const buildMoveResult = ({ sourceCategory, targetCategory, postId, postLikeCount = null }) => ({
  message: 'Post category moved successfully',
  postId,
  fromCategory: sourceCategory,
  toCategory: targetCategory,
  postLikeCount,
});

const getLegacyCommentDeleteRefs = async (postReference) => {
  const commentsSnapshot = await getDocs(collection(postReference, 'comments'));
  const likeSnapshots = await Promise.all(
    commentsSnapshot.docs.map((commentSnap) => getDocs(collection(commentSnap.ref, 'likes'))),
  );
  return commentsSnapshot.docs.flatMap((commentSnap, index) => [
    ...likeSnapshots[index].docs.map((likeSnap) => likeSnap.ref),
    commentSnap.ref,
  ]);
};

const readMoveState = async (references) => {
  const [sourcePostSnap, sourceIndexSnap, targetPostSnap, targetIndexSnap, jobSnap] =
    await Promise.all([
      getDocFromServer(references.sourcePostRef),
      getDocFromServer(references.sourceIndexRef),
      getDocFromServer(references.targetPostRef),
      getDocFromServer(references.targetIndexRef),
      getDocFromServer(references.jobRef),
    ]);

  if (
    !sourcePostSnap.exists() &&
    !sourceIndexSnap.exists() &&
    targetPostSnap.exists() &&
    targetIndexSnap.exists()
  ) {
    return { state: 'committed', job: jobSnap.exists() ? jobSnap.data() : null };
  }
  if (
    sourcePostSnap.exists() &&
    sourceIndexSnap.exists() &&
    !targetPostSnap.exists() &&
    !targetIndexSnap.exists()
  ) {
    const job = jobSnap.exists() ? jobSnap.data() : null;
    const locked = job && sourcePostSnap.data()?.categoryMoveJobId === references.jobId;
    return {
      state: locked ? 'locked' : 'unchanged',
      job,
      sourcePostData: sourcePostSnap.data() || {},
      sourceIndexData: sourceIndexSnap.data() || {},
    };
  }
  if (
    !sourcePostSnap.exists() &&
    !sourceIndexSnap.exists() &&
    !targetPostSnap.exists() &&
    !targetIndexSnap.exists() &&
    jobSnap.exists()
  ) {
    return { state: 'orphaned', job: jobSnap.data() };
  }
  return { state: 'ambiguous', job: jobSnap.exists() ? jobSnap.data() : null };
};

const completeMoveJob = async (jobRef) => {
  const batch = writeBatch(db);
  batch.delete(jobRef);
  await batch.commit();
};

const restoreMoveLock = async ({ references, originalIsPublic }) => {
  await runTransaction(db, async (transaction) => {
    const [sourcePostSnap, sourceIndexSnap, targetPostSnap, targetIndexSnap] =
      await Promise.all([
        transaction.get(references.sourcePostRef),
        transaction.get(references.sourceIndexRef),
        transaction.get(references.targetPostRef),
        transaction.get(references.targetIndexRef),
      ]);
    if (
      !sourcePostSnap.exists() ||
      !sourceIndexSnap.exists() ||
      targetPostSnap.exists() ||
      targetIndexSnap.exists()
    ) {
      throw new Error('카테고리 이동 잠금을 안전하게 복구할 수 없습니다.');
    }
    transaction.update(references.sourcePostRef, {
      isPublic: originalIsPublic,
      categoryMoveJobId: deleteField(),
    });
    transaction.update(references.sourceIndexRef, { isPublic: originalIsPublic });
  });
};

const markMoveJobPending = (error, references, { rolledBack = false } = {}) => {
  const failure = error instanceof Error ? error : new Error('카테고리 이동 상태를 확인할 수 없습니다.');
  failure.preservePreparedImages = true;
  failure.moveJobId = references.jobId;
  failure.moveRolledBack = rolledBack;
  return failure;
};

const resolveFailedMove = async ({ error, input, references }) => {
  let result;
  try {
    result = await readMoveState(references);
  } catch (stateError) {
    throw markMoveJobPending(error, references);
  }

  if (result.state === 'committed') {
    completeMoveJob(references.jobRef).catch(() => {});
    return buildMoveResult(input);
  }
  if (result.state === 'locked') {
    try {
      await restoreMoveLock({
        references,
        originalIsPublic: Boolean(result.job?.originalIsPublic),
      });
    } catch (restoreError) {
      throw markMoveJobPending(error, references);
    }
    if (uniqueStrings(result.job?.preparedImageUrls).length === 0) {
      await completeMoveJob(references.jobRef);
      throw error;
    }
    throw markMoveJobPending(error, references, { rolledBack: true });
  }
  if (result.state === 'unchanged') throw error;
  throw markMoveJobPending(error, references);
};

const beginMoveLock = async ({ input, references, preparedStorageCleanup }) => {
  let lockResult = null;
  await runTransaction(db, async (transaction) => {
    const [sourcePostSnap, sourceIndexSnap, targetPostSnap, targetIndexSnap] =
      await Promise.all([
        transaction.get(references.sourcePostRef),
        transaction.get(references.sourceIndexRef),
        transaction.get(references.targetPostRef),
        transaction.get(references.targetIndexRef),
      ]);
    if (!sourcePostSnap.exists() || !sourceIndexSnap.exists()) {
      throw new Error('원본 카테고리에서 게시글 또는 인덱스를 찾을 수 없습니다.');
    }
    if (targetPostSnap.exists() || targetIndexSnap.exists()) {
      throw new Error('대상 카테고리에 같은 게시글이 이미 있습니다.');
    }

    const sourcePostData = sourcePostSnap.data() || {};
    const sourceIndexData = sourceIndexSnap.data() || {};
    const originalIsPublic = sourcePostData.isPublic !== false;
    transaction.update(references.sourcePostRef, {
      isPublic: false,
      categoryMoveJobId: references.jobId,
    });
    transaction.update(references.sourceIndexRef, { isPublic: false });
    transaction.set(references.jobRef, {
      sourceCategory: input.sourceCategory,
      targetCategory: input.targetCategory,
      postId: input.postId,
      originalIsPublic,
      preparedImageUrls: uniqueStrings(preparedStorageCleanup?.urls),
      preparedPathPrefixes: uniqueStrings(preparedStorageCleanup?.pathPrefixes),
      createdAt: serverTimestamp(),
    });
    lockResult = { sourcePostData, sourceIndexData, originalIsPublic };
  });
  return lockResult;
};

const commitLockedMove = async ({ input, references, data, lockResult }) => {
  const sourceLikesRef = collection(references.sourcePostRef, 'likes');
  const targetLikesRef = collection(references.targetPostRef, 'likes');
  const [likesSnapshot, legacyCommentRefs] = await Promise.all([
    getDocs(sourceLikesRef),
    getLegacyCommentDeleteRefs(references.sourcePostRef),
  ]);
  const writeCount = MOVE_STATIC_WRITE_COUNT + (likesSnapshot.size * 2) + legacyCommentRefs.length;
  if (writeCount > FIRESTORE_BATCH_WRITE_LIMIT) {
    throw new Error(
      `공감과 레거시 댓글이 많아 ${FIRESTORE_BATCH_WRITE_LIMIT}회 단일 트랜잭션으로 이동할 수 없습니다.`,
    );
  }

  const updates = sanitizePostUpdates(data);
  const { categoryMoveJobId, ...unlockedSourcePostData } = lockResult.sourcePostData;
  const targetPostData = {
    ...unlockedSourcePostData,
    ...updates,
    isPublic: updates.isPublic === undefined ? lockResult.originalIsPublic : updates.isPublic,
    category: input.targetCategory,
  };

  await runTransaction(db, async (transaction) => {
    const [sourcePostSnap, sourceIndexSnap, targetPostSnap, targetIndexSnap, jobSnap] =
      await Promise.all([
        transaction.get(references.sourcePostRef),
        transaction.get(references.sourceIndexRef),
        transaction.get(references.targetPostRef),
        transaction.get(references.targetIndexRef),
        transaction.get(references.jobRef),
      ]);
    if (
      !sourcePostSnap.exists() ||
      !sourceIndexSnap.exists() ||
      sourcePostSnap.data()?.categoryMoveJobId !== references.jobId ||
      !jobSnap.exists()
    ) {
      throw new Error('카테고리 이동 잠금이 유효하지 않습니다.');
    }
    if (targetPostSnap.exists() || targetIndexSnap.exists()) {
      throw new Error('대상 카테고리에 같은 게시글이 이미 있습니다.');
    }

    transaction.set(references.targetPostRef, targetPostData);
    transaction.set(
      references.targetIndexRef,
      buildMovedIndexPayload(targetPostData, lockResult.sourceIndexData),
    );
    likesSnapshot.docs.forEach((likeSnap) => {
      transaction.set(doc(targetLikesRef, likeSnap.id), likeSnap.data());
      transaction.delete(likeSnap.ref);
    });
    legacyCommentRefs.forEach((reference) => transaction.delete(reference));
    transaction.delete(references.sourcePostRef);
    transaction.delete(references.sourceIndexRef);
  });

  completeMoveJob(references.jobRef).catch(() => {});
  return buildMoveResult({ ...input, postLikeCount: likesSnapshot.size });
};

const movePostCategoryClientSide = async ({
  fromCategory,
  toCategory,
  id,
  data = {},
  preparedStorageCleanup = {},
}) => {
  const input = normalizeMoveInput({ fromCategory, toCategory, id });
  validateMoveInput(input);
  const references = getMoveReferences(input);
  let lockResult;
  try {
    lockResult = await beginMoveLock({ input, references, preparedStorageCleanup });
  } catch (error) {
    let state;
    try {
      state = await readMoveState(references);
    } catch (stateError) {
      throw error;
    }
    if (state.state !== 'locked') throw error;
    lockResult = {
      sourcePostData: state.sourcePostData,
      sourceIndexData: state.sourceIndexData,
      originalIsPublic: Boolean(state.job?.originalIsPublic),
    };
  }

  try {
    return await commitLockedMove({ input, references, data, lockResult });
  } catch (error) {
    return resolveFailedMove({ error, input, references });
  }
};

export async function movePostCategory({
  fromCategory,
  toCategory,
  id,
  data = {},
  preparedStorageCleanup = {},
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');

  const input = normalizeMoveInput({ fromCategory, toCategory, id });
  validateMoveInput(input);
  if (!backendBaseUrl) {
    return movePostCategoryClientSide({
      fromCategory,
      toCategory,
      id,
      data,
      preparedStorageCleanup,
    });
  }

  const references = getMoveReferences(input);
  const idToken = await user.getIdToken();
  let response;
  try {
    response = await fetch(`${backendBaseUrl}/posts/move-category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        postId: id,
        fromCategory,
        toCategory,
        data,
        preparedStorageCleanup,
      }),
    });
  } catch (error) {
    return resolveFailedMove({
      error: new Error('카테고리 이동 서버의 응답을 확인할 수 없습니다.'),
      input,
      references,
    });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const responseError = new Error(payload?.message || '카테고리 이동에 실패했습니다.');
    if (response.status < 500) throw responseError;
    return resolveFailedMove({ error: responseError, input, references });
  }
  return payload || buildMoveResult(input);
}

export async function completePostMoveCleanupJob({ jobId }) {
  if (!jobId) return;
  await completeMoveJob(moveJobDocRef(jobId));
}

export async function retryPendingPostMoveRecoveries({
  storage,
  uid,
  role,
  deleteImages,
}) {
  if (!uid || role !== 'admin') return { completed: 0, pending: 0 };
  const snapshot = await getDocs(collection(db, 'post_move_jobs'));
  let completed = 0;
  let pending = 0;

  for (const jobSnap of snapshot.docs) {
    const job = { id: jobSnap.id, ...jobSnap.data() };
    const input = normalizeMoveInput({
      fromCategory: job.sourceCategory,
      toCategory: job.targetCategory,
      id: job.postId,
    });
    const references = getMoveReferences(input);
    try {
      const result = await readMoveState(references);
      if (result.state === 'committed') {
        await completeMoveJob(references.jobRef);
        completed += 1;
        continue;
      }
      if (result.state === 'locked') {
        await restoreMoveLock({
          references,
          originalIsPublic: Boolean(job.originalIsPublic),
        });
      } else if (result.state !== 'unchanged' && result.state !== 'orphaned') {
        pending += 1;
        continue;
      }
      const preparedImageUrls = uniqueStrings(job.preparedImageUrls);
      if (preparedImageUrls.length > 0) {
        if (typeof deleteImages !== 'function') {
          throw new Error('준비 이미지 정리 함수가 필요합니다.');
        }
        await deleteImages({
          urls: preparedImageUrls,
          storage,
          uid,
          role,
          pathPrefixes: uniqueStrings(job.preparedPathPrefixes),
        });
      }
      await completeMoveJob(references.jobRef);
      completed += 1;
    } catch (error) {
      pending += 1;
    }
  }
  return { completed, pending };
}
