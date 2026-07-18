# LifeSculpture Security Stabilization Implementation Plan

> 참고: 이 문서는 당시 보안 안정화 작업 기록입니다. 댓글 기능은 이후 제거되어 댓글 관련 항목은 현재 구현 범위에 적용되지 않습니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 댓글 작성/좋아요 실패, 저장형 XSS, Storage 업로드 규칙, 비밀값/배포 설정 문제를 1차 안정화 범위에서 수정한다.

**Architecture:** 현재 React 디자인과 Firebase 데이터 구조는 유지한다. 클라이언트가 카운터를 직접 신뢰성 있게 갱신하려는 흐름을 줄이고, Firestore/Storage Rules가 서버 측에서 허용 필드와 파일 메타데이터를 검증하게 한다. Vite 이전, Custom Claims 통일, 카테고리 이동 재설계는 별도 후속 계획으로 분리한다.

**Tech Stack:** React 19, Create React App, Firebase Auth/Firestore/Storage, Firebase Security Rules, DOMPurify, Firebase Emulator.

---

## Scope

이 계획에서 수정한다:

- 댓글 생성 payload와 Firestore Rules 불일치
- 댓글 좋아요의 부모 댓글 `likeCount` 직접 업데이트 실패
- 정규식 기반 HTML sanitizer와 `dangerouslySetInnerHTML` 저장형 XSS 위험
- Storage Rules의 UID 하드코딩, MIME/size 검증 누락, SVG 업로드 허용
- `frontend/.gitignore`의 `.env # Added .env` 패턴 오류
- Firebase Hosting workflow 중복과 `mypage` 경로 오류
- 위 항목을 검증하는 최소 Rules/service 테스트

이 계획에서 제외한다:

- CRA에서 Vite로 이전
- 관리자 권한을 Firebase Custom Claims로 완전 통일
- 카테고리 이동을 idempotent migration job으로 재설계
- 서버 `/auth/google`, `/auth/firebase`, 자체 JWT 제거

## References

- DOMPurify: https://github.com/cure53/DOMPurify
- Firebase Storage Rules metadata validation: https://firebase.google.com/docs/storage/security/rules-conditions
- Firestore field restrictions with `diff().affectedKeys()`: https://firebase.google.com/docs/firestore/security/rules-fields

## File Structure

- Modify: `frontend/.gitignore` - env ignore 패턴을 정확히 정리한다.
- Modify: `frontend/package.json` and `frontend/package-lock.json` - `dompurify`와 Rules 테스트 의존성을 추가한다.
- Modify: `frontend/src/components/text-editor/utils/content.js` - DOMPurify 기반 rich HTML sanitizer를 구현한다.
- Modify: `frontend/src/components/write/hooks/useWritingEditor.js` - 작성 저장 직전에 HTML을 정제한다.
- Modify: `frontend/src/pages/PostDetailPage.js` - 렌더링 직전에 HTML을 한 번 더 정제한다.
- Modify: `frontend/src/pages/EditPostPage.js` - 기존 수정 플로우가 새 sanitizer를 그대로 쓰는지 확인한다.
- Modify: `frontend/src/services/comments.js` - 댓글 생성 payload와 좋아요 write를 Rules와 맞춘다.
- Modify: `frontend/src/components/comments/hooks/useComments.js` - `syncCommentLikeCount` 의존을 제거하고 집계 기반으로 읽는다.
- Modify: `firestore.rules` - 댓글 문서 필드, 댓글 좋아요 서브컬렉션, 게시글 like legacy update를 정리한다.
- Modify: `storage.rules` - hardcoded UID를 제거하고 Firestore `users/{uid}.role` 기반 admin 검사와 file metadata 검증을 추가한다.
- Modify: `frontend/src/components/text-editor/utils/imageUpload.js` - SVG 업로드를 차단하고 Storage Rules와 MIME/size 기준을 맞춘다.
- Modify: `frontend/src/utils/storage.js` - 실제 업로드 경로(`post-images/{category}/{postId}/...`) 기준으로 삭제 권한 판단을 맞춘다.
- Modify: `.github/workflows/firebase-hosting-merge.yml` - `frontend` 기준 install/build/deploy workflow로 정리한다.
- Delete: `.github/workflows/firebase-hosting-push.yml` - `mypage` 경로를 보는 중복 배포 workflow 제거.
- Modify: `.github/workflows/firebase-hosting-pull-request.yml` - PR preview도 `frontend` 기준으로 정리한다.
- Create: `tests/rules/firestore-comments.test.js` - Firestore 댓글/좋아요 Rules 회귀 테스트.
- Create: `tests/rules/storage-post-images.test.js` - Storage 업로드 Rules 회귀 테스트.
- Create or Modify: `package.json` - Rules 테스트 스크립트를 루트에서 실행할 수 있게 한다.

---

### Task 1: Secret Ignore Hygiene

**Files:**
- Modify: `frontend/.gitignore`

- [ ] **Step 1: Fix frontend env ignore patterns**

Replace lines around `frontend/.gitignore:16-20` with:

```gitignore
.env
.env.*
!.env.example
```

Expected final relevant block:

```gitignore
# misc
.DS_Store
.env
.env.*
!.env.example
```

- [ ] **Step 2: Verify sensitive files are not tracked**

Run:

```bash
git ls-files frontend/.env server/.env server/serviceAccountKey.json
```

Expected: no output.

- [ ] **Step 3: Verify ignore behavior**

Run:

```bash
git check-ignore -v frontend/.env server/.env server/serviceAccountKey.json
```

Expected: each file is ignored by `.gitignore`, `frontend/.gitignore`, or `server/.gitignore`.

- [ ] **Step 4: Manual secret action**

If `server/serviceAccountKey.json` was ever shared or committed, revoke it in Google Cloud Console and remove every local copy. The server now uses Application Default Credentials, so a service account key file is not required for local startup or deployment.

- [ ] **Step 5: Commit**

```bash
git add frontend/.gitignore
git commit -m "chore(gitignore): 환경파일 무시 규칙 정리"
```

---

### Task 2: Comments Rules and Service Alignment

**Files:**
- Modify: `frontend/src/services/comments.js`
- Modify: `frontend/src/components/comments/hooks/useComments.js`
- Modify: `firestore.rules`
- Test: `tests/rules/firestore-comments.test.js`

- [ ] **Step 1: Write Firestore Rules tests**

Create `tests/rules/firestore-comments.test.js` with tests for:

```javascript
test('signed-in user can create a comment without client counters', async () => {
  await assertSucceeds(setDoc(commentRef, {
    authorId: 'user-a',
    authorName: 'User A',
    authorPhoto: null,
    content: 'hello',
    parentId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test('signed-in user cannot create a comment with likeCount or replyCount', async () => {
  await assertFails(setDoc(commentRef, {
    authorId: 'user-a',
    authorName: 'User A',
    authorPhoto: null,
    content: 'hello',
    parentId: null,
    likeCount: 0,
    replyCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test('signed-in user can create and delete own comment like doc', async () => {
  await assertSucceeds(setDoc(likeRef, { createdAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(likeRef));
});

test('signed-in user cannot update parent comment likeCount directly', async () => {
  await assertFails(updateDoc(commentRef, { likeCount: increment(1) }));
});
```

Use `@firebase/rules-unit-testing` and seed the parent post/comment as admin context.

- [ ] **Step 2: Run tests and confirm current failure**

Run:

```bash
npm run test:rules -- --runTestsByPath tests/rules/firestore-comments.test.js
```

Expected before implementation: at least the normal comment create or direct `likeCount` assertion exposes the current mismatch.

- [ ] **Step 3: Update `comments.js` create payload and likes**

In `frontend/src/services/comments.js`, change `createComment` so it no longer writes client counters:

```javascript
await setDoc(ref, {
  authorId,
  authorName,
  authorPhoto: authorPhoto ?? null,
  content,
  parentId: parentId ?? null,
  createdAt: timestamp,
  updatedAt: timestamp,
});
```

Change `likeComment`:

```javascript
export async function likeComment({ category, postId, commentId, uid }) {
  await setDoc(likeDoc(category, postId, commentId, uid), {
    createdAt: serverTimestamp(),
  });
}
```

Change `unlikeComment`:

```javascript
export async function unlikeComment({ category, postId, commentId, uid }) {
  await deleteDoc(likeDoc(category, postId, commentId, uid));
}
```

Remove the unused `increment` and `updateDoc` imports if no longer used in this file. Remove `syncCommentLikeCount` from this service unless another caller still needs it.

- [ ] **Step 4: Update `useComments.js` count hydration**

Remove `syncCommentLikeCount` from the import list. Replace `resolveLikeCount` with a pure read/cache flow:

```javascript
const resolveLikeCount = async (raw, category, postId) => {
  const cacheKey = getCommentCacheKey(category, postId, raw.id);

  if (commentLikeCountCache.has(cacheKey)) {
    return commentLikeCountCache.get(cacheKey);
  }

  const count = await fetchLikeCount({ category, postId, commentId: raw.id }).catch(() => 0);
  commentLikeCountCache.set(cacheKey, count);
  return count;
};
```

Keep optimistic UI updates in `handleToggleLike`; they are UI state only and no longer write parent counters.

- [ ] **Step 5: Keep Firestore Rules strict**

Keep `isValidCommentCreate` without `likeCount` and `replyCount`. Ensure comment update also excludes those fields. Keep `match /likes/{likeUid}` allowing only create/delete of the caller's own doc.

Do not add `likeCount` or `replyCount` back to allowed comment fields in this task.

- [ ] **Step 6: Run focused tests**

```bash
npm run test:rules -- --runTestsByPath tests/rules/firestore-comments.test.js
npm run build --prefix frontend
```

Expected: tests pass and frontend build exits 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/comments.js frontend/src/components/comments/hooks/useComments.js firestore.rules tests/rules/firestore-comments.test.js package.json package-lock.json
git commit -m "fix(comments): 댓글 작성과 좋아요 규칙 정합성 수정"
```

---

### Task 3: DOMPurify Rich Text Sanitization

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/components/text-editor/utils/content.js`
- Modify: `frontend/src/components/write/hooks/useWritingEditor.js`
- Modify: `frontend/src/pages/PostDetailPage.js`
- Confirm: `frontend/src/pages/EditPostPage.js`

- [ ] **Step 1: Install DOMPurify**

Run:

```bash
npm install dompurify --prefix frontend
```

Expected: `frontend/package.json` and `frontend/package-lock.json` include `dompurify`.

- [ ] **Step 2: Replace regex sanitizer with DOMPurify**

In `frontend/src/components/text-editor/utils/content.js`, implement:

```javascript
import DOMPurify from 'dompurify';

const ALLOWED_IFRAME_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
]);

const isAllowedIframeSrc = (src) => {
  if (!src || typeof window === 'undefined') return false;
  try {
    const url = new URL(src, window.location.origin);
    return url.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.has(url.hostname);
  } catch (error) {
    return false;
  }
};

const stripUnsafeEmbeds = (html) => {
  if (!html || typeof DOMParser === 'undefined') return html || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('iframe').forEach((iframe) => {
    if (!isAllowedIframeSrc(iframe.getAttribute('src'))) {
      iframe.remove();
    }
  });
  return doc.body.innerHTML;
};

export const sanitizeHtml = (html) => {
  if (!html) return '';

  const sanitized = DOMPurify.sanitize(String(html), {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'img', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'iframe',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class',
      'target', 'rel',
      'colspan', 'rowspan',
      'width', 'height', 'frameborder', 'allow', 'allowfullscreen',
      'data-line-number',
    ],
    FORBID_TAGS: ['script', 'object', 'embed', 'svg', 'math'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'srcdoc'],
  });

  return stripUnsafeEmbeds(sanitized)
    .replace(/(<p><br><\/p>\s*){2,}/g, '<p><br></p>')
    .trim();
};
```

Do not remove `calculateContentSize`, `sanitizeContent`, or `normalizeTableCellBreaksForEditor`.

- [ ] **Step 3: Sanitize on write submit**

In `frontend/src/components/write/hooks/useWritingEditor.js`, import `sanitizeHtml` and change submit flow:

```javascript
const uploadedContent = await uploadPendingImages({
  category,
  postId: docRef.id,
  sourceContent: editorContent,
});
const finalContent = sanitizeHtml(uploadedContent);
```

Use `finalContent` for tag extraction and Firestore writes.

- [ ] **Step 4: Sanitize on render**

In `frontend/src/pages/PostDetailPage.js`, import `sanitizeHtml` and change render effect:

```javascript
const { html, toc } = buildContentWithToc(sanitizeHtml(post.content));
```

Keep the JSX:

```jsx
dangerouslySetInnerHTML={{ __html: renderedContent || sanitizeHtml(post.content) }}
```

This keeps current visual structure while ensuring stored content is sanitized before DOM insertion.

- [ ] **Step 5: Confirm edit flow**

In `frontend/src/pages/EditPostPage.js`, confirm it still calls `sanitizeHtml(finalContent)` before `updatePostFields`. If it imports from the same `content.js`, no extra code change is required.

- [ ] **Step 6: Manual XSS smoke check**

Run frontend:

```bash
npm start --prefix frontend
```

As admin, create a private test post containing:

```html
<img src=x onerror=alert(1)><script>alert(2)</script><p>safe</p>
```

Expected:

- no alert fires on post detail page
- the word `safe` renders
- code block/table styling still looks like the current design

- [ ] **Step 7: Build**

```bash
npm run build --prefix frontend
```

Expected: build exits 0.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/text-editor/utils/content.js frontend/src/components/write/hooks/useWritingEditor.js frontend/src/pages/PostDetailPage.js frontend/src/pages/EditPostPage.js
git commit -m "fix(editor): 본문 HTML 정제 강화"
```

---

### Task 4: Storage Rules and Upload Validation

**Files:**
- Modify: `storage.rules`
- Modify: `frontend/src/components/text-editor/utils/imageUpload.js`
- Modify: `frontend/src/utils/storage.js`
- Test: `tests/rules/storage-post-images.test.js`

- [ ] **Step 1: Write Storage Rules tests**

Create `tests/rules/storage-post-images.test.js` with tests for:

```javascript
test('admin can upload jpeg under size limit', async () => {
  await assertSucceeds(uploadBytes(adminImageRef, new Blob(['x'], { type: 'image/jpeg' })));
});

test('normal user cannot upload post image', async () => {
  await assertFails(uploadBytes(userImageRef, new Blob(['x'], { type: 'image/jpeg' })));
});

test('admin cannot upload svg', async () => {
  await assertFails(uploadBytes(adminSvgRef, new Blob(['<svg></svg>'], { type: 'image/svg+xml' })));
});
```

Seed `/users/admin-uid` with `{ role: 'admin' }` in Firestore emulator before testing Storage Rules.

- [ ] **Step 2: Replace hardcoded UID in `storage.rules`**

Use Firestore-backed admin lookup and metadata checks:

```rules
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    function isAdmin() {
      return request.auth != null &&
             firestore.exists(/databases/(default)/documents/users/$(request.auth.uid)) &&
             firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    function isAllowedPostImage() {
      return request.resource != null &&
             request.resource.size < 5 * 1024 * 1024 &&
             request.resource.contentType.matches('image/(jpeg|jpg|png|webp|gif)');
    }

    match /image/{file=**} {
      allow read: if true;
      allow write: if false;
    }

    match /post-images/{category}/{postId}/{fileName} {
      allow read: if true;
      allow create, update: if isAdmin() && isAllowedPostImage();
      allow delete: if isAdmin();
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: Block SVG client-side**

In `frontend/src/components/text-editor/utils/imageUpload.js`, change:

```javascript
const hasImageExtension = (name) => /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name || '');
```

Remove `image/svg+xml` support from `getExtensionForType`. Change SVG handling so `isSvgFile(file)` returns an alert and `null` before upload:

```javascript
if (isSvgFile(file)) {
  alert('SVG 이미지는 보안상 업로드할 수 없어요. PNG, JPG, WebP, GIF를 사용해주세요.');
  return null;
}
```

- [ ] **Step 4: Align delete path guard**

In `frontend/src/utils/storage.js`, remove the old owner-prefix assumption:

```javascript
const isPostImagePath = path.startsWith('post-images/');
if (role !== 'admin' || !isPostImagePath) return false;
```

This matches the current upload path `post-images/{category}/{postId}/{fileName}`.

- [ ] **Step 5: Run focused tests**

```bash
npm run test:rules -- --runTestsByPath tests/rules/storage-post-images.test.js
npm run build --prefix frontend
```

Expected: tests pass and frontend build exits 0.

- [ ] **Step 6: Manual upload smoke check**

Run frontend and server if needed:

```bash
npm start
```

As admin, upload a JPG/PNG image from the writing editor. Expected: image appears in editor and post detail. Try SVG upload. Expected: client alert blocks the upload.

- [ ] **Step 7: Commit**

```bash
git add storage.rules frontend/src/components/text-editor/utils/imageUpload.js frontend/src/utils/storage.js tests/rules/storage-post-images.test.js package.json package-lock.json
git commit -m "fix(storage): 게시글 이미지 업로드 규칙 강화"
```

---

### Task 5: Post Like Guard Tightening

**Files:**
- Modify: `frontend/src/services/posts.js`
- Modify: `firestore.rules`

- [ ] **Step 1: Keep current UI but prevent negative local counts**

In `frontend/src/pages/PostDetailPage.js`, change:

```javascript
const newLikeCount = nextLikedState ? likeCount + 1 : Math.max(likeCount - 1, 0);
```

- [ ] **Step 2: Tighten legacy Firestore like update**

Replace `isLegacyLikeUpdate()` in `firestore.rules` with:

```rules
function isLegacyLikeUpdate() {
  return request.auth != null &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeCount', 'likedBy']) &&
         request.resource.data.likeCount is int &&
         request.resource.data.likeCount >= 0 &&
         request.resource.data.likedBy is list;
}
```

This is not perfect duplicate-click protection, but it blocks arbitrary field changes while preserving the current `setPostLike` behavior. Moving posts to `likes/{uid}` is a follow-up project.

- [ ] **Step 3: Build**

```bash
npm run build --prefix frontend
```

Expected: build exits 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PostDetailPage.js firestore.rules
git commit -m "fix(posts): 게시글 공감 업데이트 검증 강화"
```

---

### Task 6: Firebase Hosting Workflow Cleanup

**Files:**
- Modify: `.github/workflows/firebase-hosting-merge.yml`
- Modify: `.github/workflows/firebase-hosting-pull-request.yml`
- Delete: `.github/workflows/firebase-hosting-push.yml`

- [ ] **Step 1: Replace merge deploy workflow**

Use this full content in `.github/workflows/firebase-hosting-merge.yml`:

```yaml
name: Deploy to Firebase Hosting on merge

on:
  push:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm test -- --watchAll=false
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_LIFESCULPTURE_220B3 }}
          channelId: live
          projectId: lifesculpture-220b3
```

- [ ] **Step 2: Replace PR preview workflow**

Use this full content in `.github/workflows/firebase-hosting-pull-request.yml`:

```yaml
name: Deploy to Firebase Hosting on PR

on: pull_request

permissions:
  checks: write
  contents: read
  pull-requests: write

jobs:
  build_and_preview:
    if: ${{ github.event.pull_request.head.repo.full_name == github.repository }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm test -- --watchAll=false
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_LIFESCULPTURE_220B3 }}
          projectId: lifesculpture-220b3
```

- [ ] **Step 3: Delete duplicate push workflow**

Delete `.github/workflows/firebase-hosting-push.yml` because it deploys on `main` and references the stale `mypage` path.

- [ ] **Step 4: Validate YAML and local build**

```bash
npm run build
```

Expected: root build runs `npm run build --prefix frontend` and exits 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/firebase-hosting-merge.yml .github/workflows/firebase-hosting-pull-request.yml
git rm .github/workflows/firebase-hosting-push.yml
git commit -m "ci(hosting): Firebase 배포 워크플로 정리"
```

---

### Task 7: Rules Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/rules/setup.js`

- [ ] **Step 1: Install test dependencies**

Run:

```bash
npm install -D jest @firebase/rules-unit-testing firebase --save-prefix='^'
```

- [ ] **Step 2: Add root scripts**

In root `package.json`, set:

```json
{
  "scripts": {
    "test": "npm run test:rules",
    "test:rules": "firebase emulators:exec --only firestore,storage \"jest tests/rules --runInBand\"",
    "start": "concurrently \"npm start --prefix frontend\" \"npm run start-backend\"",
    "start-backend": "cd server && node index.js",
    "build": "npm run build --prefix frontend"
  }
}
```

Keep existing dependencies and devDependencies.

- [ ] **Step 3: Create shared rules test setup**

Create `tests/rules/setup.js`:

```javascript
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

async function createRulesTestEnv() {
  return initializeTestEnvironment({
    projectId: 'lifesculpture-test',
    firestore: {
      rules: fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8'),
    },
    storage: {
      rules: fs.readFileSync(path.join(process.cwd(), 'storage.rules'), 'utf8'),
    },
  });
}

module.exports = {
  createRulesTestEnv,
  assertFails,
  assertSucceeds,
};
```

- [ ] **Step 4: Run full verification**

```bash
npm run test:rules
npm run build
```

Expected: tests and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/rules
git commit -m "test(rules): Firebase 보안 규칙 테스트 추가"
```

---

## Manual QA Gate

Run these after all tasks:

```bash
npm run test:rules
npm run build
npm start
```

Observed behavior required:

- 일반 로그인 사용자가 댓글을 작성할 수 있다.
- 일반 로그인 사용자가 댓글 좋아요/취소를 할 수 있고 새로고침 후 카운트가 맞다.
- 댓글 좋아요가 실패해도 부모 댓글 문서의 `likeCount` 직접 업데이트 실패로 UI가 깨지지 않는다.
- `<script>`, `onerror`, `javascript:` payload가 게시글 상세에서 실행되지 않는다.
- 기존 글의 코드블록, 표, 정렬, 이미지 스타일이 크게 달라지지 않는다.
- 관리자만 JPG/PNG/WebP/GIF 이미지를 업로드할 수 있다.
- SVG 업로드는 클라이언트에서 차단되고 Rules에서도 거절된다.
- GitHub Actions는 `frontend` 경로에서만 install/build/test를 실행한다.

## Final Commit Message For This Plan Document

```bash
git add docs/superpowers/plans/2026-06-12-lifesculpture-security-stabilization.md
git commit -m "docs(plan): 보안 안정화 수정 계획 추가"
```

## Self-Review

- Spec coverage: 코드 리뷰의 즉시 수정 항목인 비밀값, 댓글 Rules, DOMPurify, Storage Rules, 게시글 좋아요 완화, workflow, Rules 테스트를 모두 포함했다.
- Placeholder scan: `TBD`, `TODO`, `fill in later`, "적절히 처리" 같은 비실행 지시를 남기지 않았다.
- Type consistency: 파일명은 현재 체크아웃 기준 경로를 사용했고, 기존 함수명 `sanitizeHtml`, `createComment`, `likeComment`, `unlikeComment`, `fetchLikeCount`를 유지했다.
- Design preservation: 렌더링 CSS/레이아웃 파일은 건드리지 않고 sanitizer 허용 태그/속성으로 기존 rich text 표현을 최대한 유지한다.
