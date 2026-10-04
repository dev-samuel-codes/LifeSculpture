const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  createBuildEnvironment,
  fetchHostingConfig,
  buildForHosting,
} = require('./build-firebase-hosting');

const config = {
  apiKey: `AIza${'a'.repeat(35)}`,
  authDomain: 'lifesculpture-220b3.firebaseapp.com',
  projectId: 'lifesculpture-220b3',
  storageBucket: 'lifesculpture-220b3.firebasestorage.app',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef123456',
  measurementId: 'G-EXAMPLE',
};

test('Hosting build replaces placeholder Firebase values while preserving unrelated environment', () => {
  const original = { PATH: '/usr/bin', REACT_APP_FIREBASE_API_KEY: '-', REACT_APP_FIREBASE_PROJECT_ID: '-' };
  const env = createBuildEnvironment(config, original);
  assert.equal(env.REACT_APP_FIREBASE_API_KEY, config.apiKey);
  assert.equal(env.REACT_APP_FIREBASE_AUTH_DOMAIN, config.authDomain);
  assert.equal(env.REACT_APP_FIREBASE_PROJECT_ID, config.projectId);
  assert.equal(env.REACT_APP_FIREBASE_STORAGE_BUCKET, config.storageBucket);
  assert.equal(env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID, config.messagingSenderId);
  assert.equal(env.REACT_APP_FIREBASE_APP_ID, config.appId);
  assert.equal(env.REACT_APP_FIREBASE_MEASUREMENT_ID, config.measurementId);
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(original.REACT_APP_FIREBASE_API_KEY, '-');
});

for (const field of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']) {
  test(`Hosting build rejects placeholder ${field} without exposing config values`, () => {
    const bad = { ...config, [field]: '-' };
    assert.throws(() => createBuildEnvironment(bad, {}), (error) => {
      assert.match(error.message, new RegExp(field));
      assert.equal(error.message.includes(config.apiKey), false);
      return true;
    });
  });
}

test('Hosting build rejects another Firebase project and inconsistent app identifiers', () => {
  assert.throws(() => createBuildEnvironment({ ...config, projectId: 'another-project' }, {}), /projectId/);
  assert.throws(() => createBuildEnvironment({ ...config, appId: '1:999:web:abcdef' }, {}), /appId/);
  assert.throws(() => createBuildEnvironment({ ...config, authDomain: 'untrusted.example' }, {}), /authDomain/);
});

test('Hosting build clears a stale optional measurement ID when it is absent', () => {
  const { measurementId, ...withoutAnalytics } = config;
  assert.equal(createBuildEnvironment(withoutAnalytics, { REACT_APP_FIREBASE_MEASUREMENT_ID: '-' }).REACT_APP_FIREBASE_MEASUREMENT_ID, '');
});

test('fetch uses only the fixed production Hosting endpoint and rejects redirects', async () => {
  let request;
  const actual = await fetchHostingConfig(async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify(config), { headers: { 'content-type': 'application/json' } });
  });
  assert.deepEqual(actual, config);
  assert.equal(request.url, 'https://lifesculpture-220b3.web.app/__/firebase/init.json');
  assert.equal(request.options.redirect, 'error');
  assert.ok(request.options.signal instanceof AbortSignal);
});

test('fetch rejects HTTP failures, HTML rewrites, malformed and oversized responses', async () => {
  await assert.rejects(fetchHostingConfig(async () => new Response('{}', { status: 404 })), /Hosting/);
  await assert.rejects(fetchHostingConfig(async () => new Response('<html>SPA</html>', { headers: { 'content-type': 'text/html' } })), /Hosting/);
  await assert.rejects(fetchHostingConfig(async () => new Response('{', { headers: { 'content-type': 'application/json' } })), /Hosting/);
  await assert.rejects(fetchHostingConfig(async () => new Response(' '.repeat(17000), { headers: { 'content-type': 'application/json' } })), /Hosting/);
});

test('build validates configuration before invoking npm and propagates build failure', async () => {
  let invocation;
  const status = await buildForHosting({
    fetchImpl: async () => new Response(JSON.stringify(config), { headers: { 'content-type': 'application/json' } }),
    spawnImpl: (command, args, options) => { invocation = { command, args, options }; return { status: 7 }; },
    env: { REACT_APP_FIREBASE_PROJECT_ID: '-' },
  });
  assert.equal(status, 7);
  assert.match(invocation.command, /^npm(?:\.cmd)?$/);
  assert.deepEqual(invocation.args, ['run', 'build']);
  assert.equal(invocation.options.env.REACT_APP_FIREBASE_PROJECT_ID, config.projectId);
  assert.match(invocation.options.cwd, /frontend$/);
  assert.equal(invocation.options.stdio, 'inherit');
  let invoked = false;
  await assert.rejects(buildForHosting({
    fetchImpl: async () => new Response(JSON.stringify({ ...config, projectId: '-' }), { headers: { 'content-type': 'application/json' } }),
    spawnImpl: () => { invoked = true; return { status: 0 }; },
    env: {},
  }), /projectId/);
  assert.equal(invoked, false);
});

test('Hosting build rejects missing and non-string configuration fields', () => {
  for (const invalid of [null, [], '-', {}]) {
    assert.throws(() => createBuildEnvironment(invalid, {}), /configuration/);
  }
  for (const field of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']) {
    for (const invalid of [undefined, null, 123, '']) {
      assert.throws(() => createBuildEnvironment({ ...config, [field]: invalid }, {}), new RegExp(field));
    }
  }
  assert.throws(() => createBuildEnvironment({ ...config, measurementId: '-' }, {}), /measurementId/);
});

test('network and timeout failures are sanitized and cannot launch a build', async () => {
  for (const name of ['TypeError', 'TimeoutError']) {
    let invoked = false;
    await assert.rejects(buildForHosting({
      fetchImpl: async () => { const error = new Error(config.apiKey); error.name = name; throw error; },
      spawnImpl: () => { invoked = true; return { status: 0 }; },
      env: {},
    }), (error) => {
      assert.equal(error.message, 'Firebase Hosting configuration request failed.');
      assert.equal(error.message.includes(config.apiKey), false);
      return true;
    });
    assert.equal(invoked, false);
  }
});

test('failed or signaled child processes fail the Hosting build', async () => {
  for (const result of [{ status: null, error: new Error('spawn failed') }, { status: null, signal: 'SIGTERM' }]) {
    assert.equal(await buildForHosting({
      fetchImpl: async () => new Response(JSON.stringify(config), { headers: { 'content-type': 'application/json' } }),
      spawnImpl: () => result,
      env: {},
    }), 1);
  }
});

test('production and preview workflows use the validated Hosting configuration', () => {
  for (const name of ['firebase-hosting-merge.yml', 'firebase-hosting-pull-request.yml']) {
    const workflow = fs.readFileSync(path.resolve(__dirname, '../..', '.github/workflows', name), 'utf8');
    assert.match(workflow, /run: node frontend\/scripts\/build-firebase-hosting\.js/);
    assert.doesNotMatch(workflow, /secrets\.REACT_APP_FIREBASE_/);
  }
});
