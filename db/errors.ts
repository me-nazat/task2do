export type DatabaseErrorCode =
  | 'DB_CONFIG'
  | 'DB_AUTH'
  | 'DB_SCHEMA'
  | 'DB_UNAVAILABLE';

export interface PublicDatabaseError {
  code: DatabaseErrorCode;
  message: string;
}

export type DatabaseActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PublicDatabaseError };

export class DatabaseError extends Error {
  code: DatabaseErrorCode;

  constructor(code: DatabaseErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

const PUBLIC_MESSAGES: Record<DatabaseErrorCode, string> = {
  DB_CONFIG: 'Database is not configured correctly. Please verify the Turso environment variables and redeploy.',
  DB_AUTH: 'Database authentication failed. Please rotate the Turso token and update the deployment environment.',
  DB_SCHEMA: 'Database schema is incomplete. Please run the Drizzle migrations against the Turso database.',
  DB_UNAVAILABLE: 'Database is temporarily unavailable. Please refresh in a moment.',
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown database error';
}

export function normalizeDatabaseError(error: unknown): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('missing turso') ||
    lowerMessage.includes('database url is not configured') ||
    lowerMessage.includes('auth token is not configured') ||
    lowerMessage.includes('url_invalid') ||
    lowerMessage.includes('not in a valid format')
  ) {
    return new DatabaseError('DB_CONFIG', PUBLIC_MESSAGES.DB_CONFIG, { cause: error as Error });
  }

  if (
    lowerMessage.includes('auth') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('token')
  ) {
    return new DatabaseError('DB_AUTH', PUBLIC_MESSAGES.DB_AUTH, { cause: error as Error });
  }

  if (
    lowerMessage.includes('no such table') ||
    lowerMessage.includes('sqlite_master') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('constraint failed')
  ) {
    return new DatabaseError('DB_SCHEMA', PUBLIC_MESSAGES.DB_SCHEMA, { cause: error as Error });
  }

  return new DatabaseError('DB_UNAVAILABLE', PUBLIC_MESSAGES.DB_UNAVAILABLE, { cause: error as Error });
}

export function toPublicDatabaseError(error: unknown): PublicDatabaseError {
  const normalizedError = normalizeDatabaseError(error);

  return {
    code: normalizedError.code,
    message: normalizedError.message,
  };
}

export function okResult<T>(data: T): DatabaseActionResult<T> {
  return { ok: true, data };
}

export function errorResult<T>(error: unknown): DatabaseActionResult<T> {
  return { ok: false, error: toPublicDatabaseError(error) };
}
