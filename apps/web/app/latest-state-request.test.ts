import { describe, expect, it } from 'vitest';

import {
  invalidateRequestSequence,
  runLatestRequest,
} from './latest-state-request';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe('latest-state request sequencing', () => {
  it('ignores an older success that completes after the newest success', async () => {
    const sequence = { current: 0 };
    const older = deferred<string>();
    const newer = deferred<string>();
    const updates: string[] = [];

    const olderRead = runLatestRequest(
      sequence,
      () => older.promise,
      (value) => updates.push(`ready:${value}`),
      () => updates.push('error'),
    );
    const newerRead = runLatestRequest(
      sequence,
      () => newer.promise,
      (value) => updates.push(`ready:${value}`),
      () => updates.push('error'),
    );

    newer.resolve('newest');
    await newerRead;
    older.resolve('stale');
    await olderRead;

    expect(updates).toEqual(['ready:newest']);
  });

  it('ignores an older failure after the newest success', async () => {
    const sequence = { current: 0 };
    const older = deferred<string>();
    const newer = deferred<string>();
    const updates: string[] = [];

    const olderRead = runLatestRequest(
      sequence,
      () => older.promise,
      (value) => updates.push(`ready:${value}`),
      () => updates.push('error'),
    );
    const newerRead = runLatestRequest(
      sequence,
      () => newer.promise,
      (value) => updates.push(`ready:${value}`),
      () => updates.push('error'),
    );

    newer.resolve('newest');
    await newerRead;
    older.reject(new Error('stale failure'));
    await olderRead;

    expect(updates).toEqual(['ready:newest']);
  });

  it('ignores older HTTP empty and error results after the newest response', async () => {
    type PanelResult =
      | { readonly kind: 'ready'; readonly value: string }
      | { readonly kind: 'empty' }
      | { readonly kind: 'error' };

    const sequence = { current: 0 };
    const olderEmpty = deferred<PanelResult>();
    const olderError = deferred<PanelResult>();
    const newest = deferred<PanelResult>();
    const updates: string[] = [];
    const applyResult = (result: PanelResult) => updates.push(result.kind);
    const applyNetworkError = () => updates.push('network-error');

    const emptyRead = runLatestRequest(
      sequence,
      () => olderEmpty.promise,
      applyResult,
      applyNetworkError,
    );
    const errorRead = runLatestRequest(
      sequence,
      () => olderError.promise,
      applyResult,
      applyNetworkError,
    );
    const newestRead = runLatestRequest(
      sequence,
      () => newest.promise,
      applyResult,
      applyNetworkError,
    );

    newest.resolve({ kind: 'ready', value: 'newest' });
    await newestRead;
    olderEmpty.resolve({ kind: 'empty' });
    olderError.resolve({ kind: 'error' });
    await Promise.all([emptyRead, errorRead]);

    expect(updates).toEqual(['ready']);
  });

  it('keeps the newest failure when an older success completes afterward', async () => {
    const sequence = { current: 0 };
    const older = deferred<string>();
    const newer = deferred<string>();
    const updates: string[] = [];

    const olderRead = runLatestRequest(
      sequence,
      () => older.promise,
      (value) => updates.push(`ready:${value}`),
      () => updates.push('error'),
    );
    const newerRead = runLatestRequest(
      sequence,
      () => newer.promise,
      (value) => updates.push(`ready:${value}`),
      () => updates.push('error'),
    );

    newer.reject(new Error('newest failure'));
    await newerRead;
    older.resolve('stale success');
    await olderRead;

    expect(updates).toEqual(['error']);
  });

  it('ignores pending results after the owning effect is cleaned up', async () => {
    const sequence = { current: 0 };
    const pending = deferred<string>();
    const updates: string[] = [];

    const read = runLatestRequest(
      sequence,
      () => pending.promise,
      (value) => updates.push(`ready:${value}`),
      () => updates.push('error'),
    );
    invalidateRequestSequence(sequence);
    pending.resolve('after cleanup');
    await read;

    expect(updates).toEqual([]);
  });
});
