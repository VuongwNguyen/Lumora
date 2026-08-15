const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEVELOPMENT_DATABASE_NAME,
  getDatabaseConfig,
  isDevelopmentDatabaseName,
} = require('../config/database');

const URL_WITHOUT_DATABASE = 'mongodb+srv://cluster.example.net/?appName=Lumora';
const URL_WITH_DEV_DATABASE = 'mongodb+srv://cluster.example.net/lumora_dev?appName=Lumora';

test('development always uses the test database', () => {
  const config = getDatabaseConfig({
    NODE_ENV: 'development',
    DATABASE_URL: URL_WITH_DEV_DATABASE,
    DATABASE_NAME: 'lumora_prod',
  });

  assert.equal(config.databaseName, DEVELOPMENT_DATABASE_NAME);
});

test('test and unspecified runtime modes also stay isolated in the test database', () => {
  const testConfig = getDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: URL_WITHOUT_DATABASE,
    DATABASE_NAME: 'lumora_prod',
  });
  const config = getDatabaseConfig({
    DATABASE_URL: URL_WITHOUT_DATABASE,
    DATABASE_NAME: 'lumora_prod',
  });

  assert.equal(testConfig.databaseName, DEVELOPMENT_DATABASE_NAME);
  assert.equal(config.databaseName, DEVELOPMENT_DATABASE_NAME);
});

test('production requires an explicit and non-development database name', () => {
  assert.throws(
    () => getDatabaseConfig({ NODE_ENV: 'production', DATABASE_URL: URL_WITHOUT_DATABASE }),
    /explicitly set in production/,
  );
  assert.throws(
    () => getDatabaseConfig({
      NODE_ENV: 'production',
      DATABASE_URL: URL_WITHOUT_DATABASE,
      DATABASE_NAME: 'test',
    }),
    /cannot use a test or development database/,
  );
  assert.throws(
    () => getDatabaseConfig({
      NODE_ENV: 'production',
      DATABASE_URL: URL_WITHOUT_DATABASE,
      DATABASE_NAME: 'lumora_dev',
    }),
    /cannot use a test or development database/,
  );

  const config = getDatabaseConfig({
    NODE_ENV: 'production',
    DATABASE_URL: URL_WITHOUT_DATABASE,
    DATABASE_NAME: 'lumora_prod',
  });
  assert.equal(config.databaseName, 'lumora_prod');
  assert.equal(isDevelopmentDatabaseName(config.databaseName), false);
});

test('database names reject unsafe characters', () => {
  assert.throws(
    () => getDatabaseConfig({
      NODE_ENV: 'production',
      DATABASE_URL: URL_WITHOUT_DATABASE,
      DATABASE_NAME: 'lumora/other',
    }),
    /only letters, numbers, underscores or hyphens/,
  );
});
