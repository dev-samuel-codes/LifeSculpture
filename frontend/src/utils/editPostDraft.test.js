import {
  EDIT_POST_DRAFT_TTL,
  areEditPostDraftFieldsEqual,
  getEditPostDraftStorageKey,
  loadEditPostDraft,
  saveEditPostDraft,
} from './editPostDraft';

describe('editPostDraft', () => {
  test('builds a versioned storage key for each post', () => {
    expect(getEditPostDraftStorageKey('study', 'post/1')).toBe(
      'settings-edit-post-draft:v1:study:post%2F1',
    );
    expect(getEditPostDraftStorageKey('blog', 'post/1')).not.toBe(
      getEditPostDraftStorageKey('study', 'post/1'),
    );
  });

  test('stores and loads only the fields required to restore editing', () => {
    const storage = window.localStorage;
    const key = getEditPostDraftStorageKey('study', 'draft-test');
    const draft = {
      title: '수정 중인 제목',
      content: '<p>수정 중인 본문</p>',
      category: 'blog',
      isPublic: false,
      tags: ['임시저장'],
      contentStyleSettings: { version: 1 },
      contentTableSettings: { tables: [] },
      ignoredServerField: '저장하지 않음',
    };

    const saved = saveEditPostDraft({ storage, key, draft, now: 1000 });
    const loaded = loadEditPostDraft({ storage, key, now: 2000 });

    expect(saved.updatedAt).toBe(1000);
    expect(loaded).toEqual({
      title: draft.title,
      content: draft.content,
      category: draft.category,
      isPublic: draft.isPublic,
      tags: draft.tags,
      contentStyleSettings: draft.contentStyleSettings,
      contentTableSettings: draft.contentTableSettings,
      updatedAt: 1000,
    });
    expect(JSON.parse(storage.getItem(key))).not.toHaveProperty('ignoredServerField');
  });

  test('removes expired drafts instead of restoring them', () => {
    const storage = window.localStorage;
    const key = getEditPostDraftStorageKey('study', 'expired-test');
    saveEditPostDraft({ storage, key, draft: { title: '만료됨' }, now: 1000 });

    expect(
      loadEditPostDraft({ storage, key, now: 1000 + EDIT_POST_DRAFT_TTL + 1 }),
    ).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  test('removes malformed drafts instead of retrying them on every load', () => {
    const storage = window.localStorage;
    const key = getEditPostDraftStorageKey('study', 'malformed-test');
    storage.setItem(key, '{invalid-json');

    expect(loadEditPostDraft({ storage, key })).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  test('compares draft content without timestamps or unrelated fields', () => {
    const base = {
      title: '제목',
      content: '<p>본문</p>',
      category: 'study',
      isPublic: true,
      tags: [],
    };

    expect(
      areEditPostDraftFieldsEqual(
        { ...base, updatedAt: 1000 },
        { ...base, updatedAt: 2000, ignoredServerField: true },
      ),
    ).toBe(true);
    expect(areEditPostDraftFieldsEqual(base, { ...base, title: '변경된 제목' })).toBe(false);
  });
});
