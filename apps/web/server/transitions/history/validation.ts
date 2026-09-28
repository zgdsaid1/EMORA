import { TransitionHistoryError } from './errors';

/**
 * Slice C1 transport validation for the bounded `limit` query parameter.
 *
 * Governance (docs/decisions/read-audit-semantics.md):
 * - Optional integer query parameter `limit`.
 * - Default: 10. Maximum: 50.
 * - Values below 1, above 50, or non-integer values return 400 `invalid_input`.
 */
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

/** Strict positive-integer form: digits only, no sign, no decimals, no space. */
const POSITIVE_INTEGER = /^\d+$/;

export function parseLimit(value: string | null): number {
  if (value === null) {
    return DEFAULT_LIMIT;
  }
  if (!POSITIVE_INTEGER.test(value)) {
    throw new TransitionHistoryError('invalid_input');
  }
  const limit = Number(value);
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new TransitionHistoryError('invalid_input');
  }
  return limit;
}
