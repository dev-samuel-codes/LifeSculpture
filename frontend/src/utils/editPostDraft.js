const EDIT_POST_DRAFT_VERSION = 2;
const EDIT_POST_DRAFT_PREFIX = `settings-edit-post-draft:v${EDIT_POST_DRAFT_VERSION}`;
const LEGACY_EDIT_POST_DRAFT_PREFIX = 'settings-edit-post-draft:v1';

export const EDIT_POST_DRAFT_TTL = 1000 * 60 * 60 * 24 * 30;

export const getEditPostDraftStorageKey = (uid, category, id) =>
  uid
    ? `${EDIT_POST_DRAFT_PREFIX}:${encodeURIComponent(uid)}:${encodeURIComponent(category)}:${encodeURIComponent(id)}`
    : null;

export const getLegacyEditPostDraftStorageKey = (category, id) =>
  `${LEGACY_EDIT_POST_DRAFT_PREFIX}:${encodeURIComponent(category)}:${encodeURIComponent(id)}`;

export const getEditPostDraftFields = (draft = {}) => ({
  title: String(draft.title ?? ''),
  content: String(draft.content ?? ''),
  category: String(draft.category ?? ''),
  isPublic: typeof draft.isPublic === 'boolean' ? draft.isPublic : true,
  tags: Array.isArray(draft.tags) ? draft.tags.map((tag) => String(tag)) : [],
  contentStyleSettings: draft.contentStyleSettings ?? null,
  contentTableSettings: draft.contentTableSettings ?? null,
});

export const areEditPostDraftFieldsEqual = (left, right) =>
  JSON.stringify(getEditPostDraftFields(left)) ===
  JSON.stringify(getEditPostDraftFields(right));

export const loadEditPostDraft = ({ storage, key, now = Date.now() }) => {
  if (!storage || !key) return null;
  try {
    const rawDraft = storage.getItem(key);
    if (!rawDraft) return null;

    const parsedDraft = JSON.parse(rawDraft);
    const isValidDraft =
      parsedDraft &&
      typeof parsedDraft === 'object' &&
      parsedDraft.version === EDIT_POST_DRAFT_VERSION &&
      typeof parsedDraft.updatedAt === 'number';

    if (!isValidDraft || now - parsedDraft.updatedAt > EDIT_POST_DRAFT_TTL) {
      storage.removeItem(key);
      return null;
    }

    return {
      ...getEditPostDraftFields(parsedDraft),
      updatedAt: parsedDraft.updatedAt,
    };
  } catch (error) {
    try {
      storage.removeItem(key);
    } catch {}
    return null;
  }
};

export const saveEditPostDraft = ({ storage, key, draft, now = Date.now() }) => {
  if (!storage || !key) throw new Error('Draft storage and user-scoped key are required.');
  const payload = {
    version: EDIT_POST_DRAFT_VERSION,
    ...getEditPostDraftFields(draft),
    updatedAt: now,
  };

  storage.setItem(key, JSON.stringify(payload));
  return payload;
};

export const removeEditPostDraft = ({ storage, key }) => {
  if (!storage || !key) return true;
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
};
