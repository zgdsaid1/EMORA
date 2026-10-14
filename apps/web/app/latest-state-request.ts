export interface RequestSequence {
  current: number;
}

export function invalidateRequestSequence(sequence: RequestSequence): void {
  sequence.current += 1;
}

export async function runLatestRequest<T>(
  sequence: RequestSequence,
  request: () => Promise<T>,
  onSuccess: (result: T) => void,
  onError: () => void,
): Promise<void> {
  const requestId = ++sequence.current;
  let result: T;

  try {
    result = await request();
  } catch {
    if (requestId === sequence.current) onError();
    return;
  }

  if (requestId === sequence.current) onSuccess(result);
}
