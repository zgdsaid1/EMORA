/**
 * Slice C1 (Transition History read) error taxonomy and response envelope.
 * Mirrors the Slice 1/Slice 2 envelope shape (`{ error: { code, message,
 * requestId } }`). Messages are fixed per code so no stack trace, SQL, internal
 * exception message, raw persisted event, or request payload can reach a client.
 */
export type TransitionHistoryErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'internal_error';

export const TRANSITION_HISTORY_ERROR_STATUS: Readonly<
  Record<TransitionHistoryErrorCode, number>
> = Object.freeze({
  unauthenticated: 401,
  forbidden: 403,
  invalid_input: 400,
  internal_error: 500,
});

const SAFE_MESSAGES: Readonly<Record<TransitionHistoryErrorCode, string>> =
  Object.freeze({
    unauthenticated: 'A valid session is required.',
    forbidden: 'Project access is not permitted.',
    invalid_input: 'The request is not valid.',
    internal_error: 'The transition history could not be read.',
  });

export class TransitionHistoryError extends Error {
  readonly code: TransitionHistoryErrorCode;
  readonly status: number;
  /** Operational (log-only) category. Never sent to the client. */
  readonly errorCategory: string;

  constructor(
    code: TransitionHistoryErrorCode,
    errorCategory: string = code,
    message?: string,
  ) {
    super(message ?? SAFE_MESSAGES[code]);
    this.name = 'TransitionHistoryError';
    this.code = code;
    this.status = TRANSITION_HISTORY_ERROR_STATUS[code];
    this.errorCategory = errorCategory;
  }
}

export interface TransitionHistoryErrorEnvelope {
  readonly error: {
    readonly code: TransitionHistoryErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

export function toErrorEnvelope(
  error: TransitionHistoryError,
  requestId: string,
): TransitionHistoryErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: SAFE_MESSAGES[error.code],
      requestId,
    },
  };
}
