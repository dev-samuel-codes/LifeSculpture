const assert = require('node:assert/strict');
const { test } = require('node:test');

async function getHostingOrigin() {
  const hubResponse = await fetch(`http://${process.env.FIREBASE_EMULATOR_HUB}/emulators`);
  const emulators = await hubResponse.json();
  return `http://${emulators.hosting.host}:${emulators.hosting.port}`;
}

test('SPA routes with dots are not cached', async () => {
  // Given: a valid client-side route containing a dot in its document id.
  const routeUrl = new URL('/posts/blog/id.with.dot', await getHostingOrigin());

  // When: Firebase Hosting rewrites the route to index.html.
  const response = await fetch(routeUrl);

  // Then: the HTML shell is always revalidated.
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
});

test('unhashed manifest files are not immutable', async () => {
  // Given: the stable public manifest URL.
  const manifestUrl = new URL('/manifest.json', await getHostingOrigin());

  // When: Firebase Hosting serves the manifest.
  const response = await fetch(manifestUrl);

  // Then: clients do not retain it for one year.
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
});
