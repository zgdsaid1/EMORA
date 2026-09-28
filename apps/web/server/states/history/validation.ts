import { StateHistoryError } from './errors';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

const POSITIVE_INTEGER = /^\d+$/;

export function parseLimit(value: string | null): number {
  if (value === null) return DEFAULT_LIMIT;
  if (!POSITIVE_INTEGER.test(value)) {
    throw new StateHistoryError('invalid_input');
  }
  const limit = Number(value);
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new StateHistoryError('invalid_input');
  }
  return limit;
}