export type StateHistoryErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'state_data_invalid'
  | 'internal_error';

export const STATE_HISTORY_ERROR_STATUS: Readonly<
  Record<StateHistoryErrorCode, number>
> = Object.freeze({
  unauthenticated: 401,
  forbidden: 403,
  invalid_input: 400,
  state_data_invalid: 500,
  internal_error: 500,
});

const SAFE_MESSAGES: Readonly<Record<StateHistoryErrorCode, string>> =
  Object.freeze({
    unauthenticated: 'A valid session is required.',
    forbidden: 'Project access is not permitted.',
    invalid_input: 'The request is not valid.',
    state_data_invalid:
      'The stored emotional state is not valid. The state was not returned.',
    internal_error: 'The emotional state history could not be read.',
  });

export class StateHistoryError extends Error {
  readonly code: StateHistoryErrorCode;
  readonly status: number;
  readonly errorCategory: string;

  constructor(
    code: StateHistoryErrorCode,
    errorCategory: string = code,
  ) {
    super(SAFE_MESSAGES[code]);
    this.name = 'StateHistoryError';
    this.code = code;
    this.status = STATE_HISTORY_ERROR_STATUS[code];
    this.errorCategory = errorCategory;
  }
}

export interface StateHistoryErrorEnvelope {
  readonly error: {
    readonly code: StateHistoryErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

export function toErrorEnvelope(
  error: StateHistoryError,
  requestId: string,
): StateHistoryErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: SAFE_MESSAGES[error.code],
      requestId,
    },
  };
}