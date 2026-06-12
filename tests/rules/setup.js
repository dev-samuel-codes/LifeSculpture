const fs = require('fs');
const path = require('path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'lifesculpture-220b3';

async function createRulesTestEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8'),
    },
    storage: {
      rules: fs.readFileSync(path.join(process.cwd(), 'storage.rules'), 'utf8'),
    },
  });
}

module.exports = {
  PROJECT_ID,
  assertFails,
  assertSucceeds,
  createRulesTestEnv,
};
