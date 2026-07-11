const requiredEnvKeys = [
  'REACT_APP_GOOGLE_CLIENT_ID',
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
require('react-scripts/config/env');

const missingKeys = requiredEnvKeys.filter((key) => {
  const value = process.env[key];
  return typeof value !== 'string' || value.trim() === '';
});

if (missingKeys.length > 0) {
  console.error(
    [
      'Missing required frontend build environment variables:',
      ...missingKeys.map((key) => `- ${key}`),
      '',
      'Set them in a supported frontend/.env* file or the deployment environment before running npm run build.',
    ].join('\n')
  );
  process.exit(1);
}
