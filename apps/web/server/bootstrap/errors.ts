export type BootstrapErrorCode =
  | 'unauthenticated'
  | 'invalid_input'
  | 'invalid_content_type'
  | 'bootstrap_already_initialized'
  | 'bootstrap_slug_conflict'
  | 'internal_error';

const STATUS_BY_CODE: Readonly<Record<BootstrapErrorCode, number>> =
  Object.freeze({
    unauthenticated: 401,
    invalid_input: 400,
    invalid_content_type: 400,
    bootstrap_already_initialized: 409,
    bootstrap_slug_conflict: 409,
    internal_error: 500,
  });

const SAFE_MESSAGES: Readonly<Record<BootstrapErrorCode, string>> =
  Object.freeze({
    unauthenticated: 'A valid session is required.',
    invalid_input: 'The request is not valid.',
    invalid_content_type: 'The request body must be JSON.',
    bootstrap_already_initialized:
      'This account already has an authorized project.',
    bootstrap_slug_conflict: 'An organization or project slug is unavailable.',
    internal_error: 'The workspace could not be initialized.',
  });

export class BootstrapError extends Error {
  readonly status: number;

  constructor(readonly code: BootstrapErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = 'BootstrapError';
    this.status = STATUS_BY_CODE[code];
  }
}

export interface BootstrapErrorEnvelope {
  readonly error: {
    readonly code: BootstrapErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

export function toErrorEnvelope(
  error: BootstrapError,
  requestId: string,
): BootstrapErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: SAFE_MESSAGES[error.code],
      requestId,
    },
  };
}