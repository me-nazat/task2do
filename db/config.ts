import { DatabaseError } from './errors';

const LOCAL_DATABASE_URL = 'file:local.db';

function normalizeEnvValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue || trimmedValue === 'undefined' || trimmedValue === 'null') {
    return undefined;
  }

  return trimmedValue;
}

function isDeployedEnvironment() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

export interface DatabaseConfig {
  url: string;
  authToken?: string;
  usingLocalFallback: boolean;
}

function resolveDatabaseConfig(): DatabaseConfig {
  const databaseUrl = normalizeEnvValue(process.env.TURSO_DATABASE_URL);
  const authToken = normalizeEnvValue(process.env.TURSO_AUTH_TOKEN);

  if (!databaseUrl) {
    if (!isDeployedEnvironment()) {
      return {
        url: LOCAL_DATABASE_URL,
        usingLocalFallback: true,
      };
    }

    throw new DatabaseError(
      'DB_CONFIG',
      'Turso database URL is not configured for this deployment.'
    );
  }

  if (!databaseUrl.startsWith('libsql://') && !databaseUrl.startsWith('https://') && !databaseUrl.startsWith('file:')) {
    throw new DatabaseError(
      'DB_CONFIG',
      'Turso database URL is not configured correctly. Expected a libsql, https, or file URL.'
    );
  }

  if (databaseUrl.startsWith('file:')) {
    if (isDeployedEnvironment()) {
      throw new DatabaseError(
        'DB_CONFIG',
        'Local SQLite fallback is disabled for deployed environments.'
      );
    }

    return {
      url: databaseUrl,
      usingLocalFallback: true,
    };
  }

  if (!authToken) {
    throw new DatabaseError(
      'DB_CONFIG',
      'Turso auth token is not configured for this deployment.'
    );
  }

  return {
    url: databaseUrl,
    authToken,
    usingLocalFallback: false,
  };
}

export const databaseConfig = resolveDatabaseConfig();
