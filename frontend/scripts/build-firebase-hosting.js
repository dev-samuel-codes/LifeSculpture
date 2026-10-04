const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ID = 'lifesculpture-220b3';
const CONFIG_URL = `https://${PROJECT_ID}.web.app/__/firebase/init.json`;
const CONFIG_FIELDS = {
  apiKey: 'REACT_APP_FIREBASE_API_KEY',
  authDomain: 'REACT_APP_FIREBASE_AUTH_DOMAIN',
  projectId: 'REACT_APP_FIREBASE_PROJECT_ID',
  storageBucket: 'REACT_APP_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REACT_APP_FIREBASE_APP_ID',
};

function createBuildEnvironment(config, originalEnv = process.env) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Firebase Hosting configuration must be an object.');
  }
  const validators = {
    apiKey: (value) => /^AIza[A-Za-z0-9_-]{35}$/.test(value),
    authDomain: (value) => value === `${PROJECT_ID}.firebaseapp.com`,
    projectId: (value) => value === PROJECT_ID,
    storageBucket: (value) => [`${PROJECT_ID}.firebasestorage.app`, `${PROJECT_ID}.appspot.com`].includes(value),
    messagingSenderId: (value) => /^\d+$/.test(value),
    appId: (value) => /^1:\d+:web:[a-f0-9]+$/i.test(value) && value.split(':')[1] === config.messagingSenderId,
  };
  const environment = { ...originalEnv };
  for (const [field, envKey] of Object.entries(CONFIG_FIELDS)) {
    if (typeof config[field] !== 'string' || !validators[field](config[field])) {
      throw new Error(`Invalid Firebase Hosting configuration field: ${field}`);
    }
    environment[envKey] = config[field];
  }
  if (config.measurementId !== undefined &&
      (typeof config.measurementId !== 'string' || !/^G-[A-Z0-9]+$/.test(config.measurementId))) {
    throw new Error('Invalid Firebase Hosting configuration field: measurementId');
  }
  environment.REACT_APP_FIREBASE_MEASUREMENT_ID = config.measurementId || '';
  return environment;
}

async function fetchHostingConfig(fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(CONFIG_URL, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Firebase Hosting configuration request failed.');
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Firebase Hosting configuration response was unsuccessful or not JSON.');
  }
  try {
    const body = await response.text();
    if (body.length > 16384) throw new Error('oversized');
    return JSON.parse(body);
  } catch {
    throw new Error('Firebase Hosting configuration response was invalid.');
  }
}

async function buildForHosting({ fetchImpl = fetch, spawnImpl = spawnSync, env = process.env } = {}) {
  const config = await fetchHostingConfig(fetchImpl);
  const buildEnv = createBuildEnvironment(config, env);
  const result = spawnImpl(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: path.resolve(__dirname, '..'),
    env: buildEnv,
    stdio: 'inherit',
  });
  if (result.error || result.signal || result.status === null) return 1;
  return result.status;
}

if (require.main === module) {
  buildForHosting().then((status) => { process.exitCode = status; }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createBuildEnvironment, fetchHostingConfig, buildForHosting };
