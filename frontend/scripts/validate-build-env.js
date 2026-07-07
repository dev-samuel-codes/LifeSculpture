const fs = require('fs');
const path = require('path');

const requiredEnvKeys = [
  'REACT_APP_GOOGLE_CLIENT_ID',
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

const envPath = path.resolve(__dirname, '..', '.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');

      if (key && process.env[key] === undefined) {
        acc[key] = value;
      }

      return acc;
    }, {});
}

const envFileValues = loadEnvFile(envPath);

const missingKeys = requiredEnvKeys.filter((key) => {
  const value = process.env[key] ?? envFileValues[key];
  return typeof value !== 'string' || value.trim() === '';
});

if (missingKeys.length > 0) {
  console.error(
    [
      'Missing required frontend build environment variables:',
      ...missingKeys.map((key) => `- ${key}`),
      '',
      'Set them in frontend/.env or the deployment environment before running npm run build.',
    ].join('\n')
  );
  process.exit(1);
}
