const FALLBACK_RETURN_TO = '/app';
const CANONICAL_CONTEXT_TARGET =
  /^\/app\?projectId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})&profileId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function validateReturnTarget(candidate: unknown): string {
  if (candidate === FALLBACK_RETURN_TO) return FALLBACK_RETURN_TO;
  if (typeof candidate !== 'string') {
    return FALLBACK_RETURN_TO;
  }

  const match = CANONICAL_CONTEXT_TARGET.exec(candidate);
  if (!match) return FALLBACK_RETURN_TO;

  return `${FALLBACK_RETURN_TO}?projectId=${match[1]}&profileId=${match[2]}`;
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
