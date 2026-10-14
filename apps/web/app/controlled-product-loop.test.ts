import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Slice 4A — controlled product loop (source-scan convention). After a
 * confirmed successful transition, the latest-state panel re-reads the same
 * authorized project/profile. The refresh must be gated strictly on a 2xx
 * response: validation errors, failed requests, and unauthorized responses
 * must never trigger it.
 */

const workspaceSource = readFileSync(
  fileURLToPath(new URL('./workspace-view.tsx', import.meta.url)),
  'utf8',
);
const transitionSource = readFileSync(
  fileURLToPath(new URL('./transition-form.tsx', import.meta.url)),
  'utf8',
);
const panelSource = readFileSync(
  fileURLToPath(new URL('./latest-state-panel.tsx', import.meta.url)),
  'utf8',
);

describe('Slice 4A controlled product loop', () => {
  it('wires a successful transition to a latest-state refresh', () => {
    // The parent lifts a refresh signal and hands it to both children.
    expect(workspaceSource).toContain(
      'const [latestStateRefreshKey, setLatestStateRefreshKey] = useState(0)',
    );
    expect(workspaceSource).toContain('refreshKey={latestStateRefreshKey}');
    expect(workspaceSource).toContain('onTransitionSucceeded={() =>');
    expect(workspaceSource).toContain(
      'setLatestStateRefreshKey((key) => key + 1)',
    );

    // The transition form exposes the success callback.
    expect(transitionSource).toContain('onTransitionSucceeded?: () => void;');
    expect(transitionSource).toContain('onTransitionSucceeded?.();');

    // The panel re-runs its read when the refresh key changes.
    expect(panelSource).toContain('refreshKey?: number;');
    expect(panelSource).toContain('}, [load, refreshKey]);');
  });

  it('signals success only after a confirmed 2xx response', () => {
    const unauthorized = transitionSource.indexOf(
      'handleUnauthorizedResponse(',
    );
    const notOk = transitionSource.indexOf('if (!response.ok) {');
    const setResult = transitionSource.indexOf(
      'setResult(body as TransitionResponse);',
    );
    const signal = transitionSource.indexOf('onTransitionSucceeded?.();');
    const catchBlock = transitionSource.lastIndexOf('} catch {');

    // Every marker must be present, and the success signal must fire only
    // after the confirmed success assignment and both failure branches.
    expect(unauthorized).toBeGreaterThan(-1);
    expect(notOk).toBeGreaterThan(unauthorized);
    expect(setResult).toBeGreaterThan(notOk);
    expect(signal).toBeGreaterThan(setResult);
    expect(signal).toBeLessThan(catchBlock);
  });

  it('does not signal success on the error or catch paths', () => {
    const notOkBranch = transitionSource.slice(
      transitionSource.indexOf('if (!response.ok) {'),
      transitionSource.indexOf('setResult(body as TransitionResponse);'),
    );
    expect(notOkBranch).toContain('setResult(null);');
    expect(notOkBranch).toContain('setError(');
    expect(notOkBranch).toContain("t('wsTransitionFailed')");
    expect(notOkBranch).not.toContain('onTransitionSucceeded');

    const catchBranch = transitionSource.slice(
      transitionSource.lastIndexOf('} catch {'),
      transitionSource.indexOf('} finally {'),
    );
    expect(catchBranch).toContain("setError(t('wsTransitionFailed'))");
    expect(catchBranch).not.toContain('onTransitionSucceeded');
  });
});
