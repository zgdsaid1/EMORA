const FALLBACK_RETURN_TO = '/app';
const VALIDATION_ORIGIN = 'https://emora.invalid';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateReturnTarget(candidate: unknown): string {
  const hasControlCharacter =
    typeof candidate === 'string' &&
    [...candidate].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    });

  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    hasControlCharacter
  ) {
    return FALLBACK_RETURN_TO;
  }

  try {
    const target = new URL(candidate, VALIDATION_ORIGIN);
    if (
      target.origin !== VALIDATION_ORIGIN ||
      target.pathname !== FALLBACK_RETURN_TO ||
      target.hash
    ) {
      return FALLBACK_RETURN_TO;
    }

    const params = new URLSearchParams();
    for (const key of ['projectId', 'profileId']) {
      const values = target.searchParams.getAll(key);
      if (values.length > 1) return FALLBACK_RETURN_TO;
      if (values.length === 1 && UUID.test(values[0])) {
        params.set(key, values[0]);
      }
    }

    const query = params.toString();
    return query ? `${FALLBACK_RETURN_TO}?${query}` : FALLBACK_RETURN_TO;
  } catch {
    return FALLBACK_RETURN_TO;
  }
}

export function handleUnauthorizedResponse(
  status: number,
  returnTarget: unknown,
  navigate: (url: string) => void,
): boolean {
  if (status !== 401) return false;

  const safeTarget = validateReturnTarget(returnTarget);
  navigate(`/login?callbackUrl=${encodeURIComponent(safeTarget)}`);
  return true;
}
