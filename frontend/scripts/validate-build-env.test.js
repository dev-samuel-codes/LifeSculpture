const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const { spawnSync } = require('node:child_process');

const requiredEnvKeys = [
  'REACT_APP_GOOGLE_CLIENT_ID',
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

const cleanProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !requiredEnvKeys.includes(key)),
);

let fixtureDirectory;

beforeEach(() => {
  fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lifesculpture-env-'));
  fs.mkdirSync(path.join(fixtureDirectory, 'scripts'));
  fs.copyFileSync(
    path.join(__dirname, 'validate-build-env.js'),
    path.join(fixtureDirectory, 'scripts', 'validate-build-env.js'),
  );
  fs.writeFileSync(path.join(fixtureDirectory, 'package.json'), '{}\n');
  fs.symlinkSync(path.resolve(__dirname, '..', 'node_modules'), path.join(fixtureDirectory, 'node_modules'));
});

afterEach(() => {
  fs.rmSync(fixtureDirectory, { recursive: true, force: true });
});

function createEnv(overrides = {}) {
  return requiredEnvKeys
    .map((key) => `${key}=${overrides[key] ?? `fixture-${key.toLowerCase()}`}`)
    .join('\n');
}

function runValidator() {
  return spawnSync(process.execPath, ['scripts/validate-build-env.js'], {
    cwd: fixtureDirectory,
    encoding: 'utf8',
    env: cleanProcessEnv,
  });
}

test('validator accepts values from .env.production', () => {
  // Given: every required value exists only in CRA's production env file.
  fs.writeFileSync(path.join(fixtureDirectory, '.env.production'), createEnv());

  // When: the build validator runs.
  const result = runValidator();

  // Then: the production configuration is accepted.
  assert.equal(result.status, 0, result.stderr);
});

test('validator rejects an empty higher-priority production value', () => {
  // Given: .env is valid but .env.production overrides one value with an empty string.
  fs.writeFileSync(path.join(fixtureDirectory, '.env'), createEnv());
  fs.writeFileSync(path.join(fixtureDirectory, '.env.production'), 'REACT_APP_FIREBASE_API_KEY=\n');

  // When: the build validator runs.
  const result = runValidator();

  // Then: the final CRA value is rejected.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /REACT_APP_FIREBASE_API_KEY/);
});

test('validator rejects a variable that expands to an empty value', () => {
  // Given: a required value references an unset variable.
  fs.writeFileSync(
    path.join(fixtureDirectory, '.env'),
    createEnv({ REACT_APP_FIREBASE_API_KEY: '${UNSET_FIREBASE_KEY}' }),
  );

  // When: the build validator runs.
  const result = runValidator();

  // Then: the expanded empty value is rejected.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /REACT_APP_FIREBASE_API_KEY/);
});
