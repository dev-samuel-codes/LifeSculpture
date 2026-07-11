const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveUserRole } = require('./authz');

const createFirestore = (role, exists = true) => ({
  collection: () => ({
    doc: () => ({
      get: async () => ({
        exists,
        data: () => (exists ? { role } : undefined),
      }),
    }),
  }),
});

test('returns user when no stored role exists', async () => {
  // Given: Firebase Authentication accepted a user without a Firestore role document.
  const firestore = createFirestore(null, false);

  // When: the application resolves the authorization role.
  const role = await resolveUserRole(firestore, 'new-user');

  // Then: the caller receives only the least-privileged role.
  assert.equal(role, 'user');
});

test('returns admin only when the stored role is admin', async () => {
  // Given: an administrator role was provisioned in Firestore.
  const firestore = createFirestore('admin');

  // When: the application resolves the authorization role.
  const role = await resolveUserRole(firestore, 'admin-user');

  // Then: the stored role is preserved.
  assert.equal(role, 'admin');
});

test('does not derive admin role from an email address', async () => {
  // Given: a non-admin role document and an email matching an external configuration value.
  const firestore = createFirestore('user');

  // When: the role is resolved using only the trusted role store.
  const role = await resolveUserRole(firestore, 'ordinary-user', 'admin@example.com');

  // Then: the email value cannot elevate the caller.
  assert.equal(role, 'user');
});

test('rejects when the trusted role store is unavailable', async () => {
  // Given: the trusted role lookup fails before returning a snapshot.
  const firestore = {
    collection: () => ({
      doc: () => ({
        get: async () => {
          throw new Error('role store unavailable');
        },
      }),
    }),
  };

  // When: the application resolves authorization during the outage.
  const lookup = resolveUserRole(firestore, 'admin-user');

  // Then: authentication fails closed instead of persisting a downgraded role.
  await assert.rejects(lookup, /role store unavailable/);
});
