import { act, renderHook } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { useAuthSession } from './useAuthSession';

jest.mock('../firebase/firebase', () => ({
  auth: { name: 'auth' },
  db: { name: 'db' },
  googleProvider: { name: 'google' },
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, collection, uid) => ({ collection, db, uid })),
  getDoc: jest.fn(),
}));

let emitAuthState;

beforeEach(() => {
  jest.clearAllMocks();
  onAuthStateChanged.mockImplementation((auth, observer) => {
    emitAuthState = observer;
    return jest.fn();
  });
});

const deferred = () => {
  let resolve;
  const promise = new Promise((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

const user = (uid) => ({
  uid,
  displayName: uid,
  email: `${uid}@example.invalid`,
  photoURL: null,
});

const roleSnapshot = (role) => ({
  exists: () => true,
  data: () => ({ role }),
});

test('ignores an obsolete role lookup after sign out', async () => {
  // Given: a pending administrator lookup for the current user.
  const pendingRole = deferred();
  getDoc.mockReturnValueOnce(pendingRole.promise);
  const { result } = renderHook(() => useAuthSession());

  // When: sign-out is observed before the role lookup resolves.
  await act(async () => {
    const staleLookup = emitAuthState(user('admin-a'));
    await emitAuthState(null);
    pendingRole.resolve(roleSnapshot('admin'));
    await staleLookup;
  });

  // Then: the signed-out session cannot regain the obsolete administrator role.
  expect(result.current.isAuthenticated).toBe(false);
  expect(result.current.uid).toBeNull();
  expect(result.current.role).toBeNull();
});

test('keeps the newest role when an older lookup resolves last', async () => {
  // Given: a slow first lookup followed by a fast second-user lookup.
  const firstRole = deferred();
  const secondRole = deferred();
  getDoc
    .mockReturnValueOnce(firstRole.promise)
    .mockReturnValueOnce(secondRole.promise);
  const { result } = renderHook(() => useAuthSession());

  // When: the second user resolves before the obsolete first lookup.
  await act(async () => {
    const staleLookup = emitAuthState(user('admin-a'));
    const currentLookup = emitAuthState(user('user-b'));
    secondRole.resolve(roleSnapshot('user'));
    await currentLookup;
    firstRole.resolve(roleSnapshot('admin'));
    await staleLookup;
  });

  // Then: identity and role remain bound to the newest authenticated user.
  expect(result.current.uid).toBe('user-b');
  expect(result.current.role).toBe('user');
});
