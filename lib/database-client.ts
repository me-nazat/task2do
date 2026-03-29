import { DatabaseActionResult } from '@/db/errors';

export function unwrapDatabaseResult<T>(result: DatabaseActionResult<T>): T {
  if (result.ok) {
    return result.data;
  }

  const error = new Error(result.error.message);
  Object.assign(error, { code: result.error.code });
  throw error;
}

export function getClientErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return fallbackMessage;
}
