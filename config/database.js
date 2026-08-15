const SAFE_DATABASE_NAME = /^[A-Za-z0-9_-]{1,63}$/;
const DEVELOPMENT_DATABASE_NAME = 'test';

function validateDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error('DATABASE_URL is not a valid MongoDB connection string');
  }
}

function isDevelopmentDatabaseName(databaseName) {
  const normalized = databaseName.toLowerCase();
  return normalized === 'test'
    || normalized === 'dev'
    || normalized === 'development'
    || normalized.endsWith('_dev')
    || normalized.endsWith('-dev')
    || normalized.endsWith('_development')
    || normalized.endsWith('-development');
}

function getDatabaseConfig(env = process.env) {
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  validateDatabaseUrl(databaseUrl);

  const configuredName = String(env.DATABASE_NAME || '').trim();
  const isProduction = env.NODE_ENV === 'production';
  const databaseName = isProduction ? configuredName : DEVELOPMENT_DATABASE_NAME;

  if (isProduction && !configuredName) {
    throw new Error('DATABASE_NAME must be explicitly set in production');
  }

  if (!SAFE_DATABASE_NAME.test(databaseName)) {
    throw new Error('DATABASE_NAME must contain only letters, numbers, underscores or hyphens (maximum 63 characters)');
  }

  if (isProduction) {
    if (isDevelopmentDatabaseName(databaseName)) {
      throw new Error('Production cannot use a test or development database');
    }
  }

  return Object.freeze({ databaseUrl, databaseName });
}

module.exports = {
  DEVELOPMENT_DATABASE_NAME,
  getDatabaseConfig,
  isDevelopmentDatabaseName,
  validateDatabaseUrl,
};
