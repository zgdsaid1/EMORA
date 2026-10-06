import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { messages } from './shell/messages';

/**
 * Slice 2 scientific boundary scan: the panel may describe only a computational
 * / model-estimated state, must reuse the frozen disclosure constant, and must
 * never render confidence or internal metadata.
 */

const panelSource = readFileSync(
  fileURLToPath(new URL('./latest-state-panel.tsx', import.meta.url)),
  'utf8',
);

describe('Slice 2 panel scientific wording boundary', () => {
  it('uses only the allowed UI wording', () => {
    // M0: visible wording resolves through the presentation dictionary; the
    // EN dictionary preserves the previously frozen English wording.
    expect(panelSource).toContain("t('wsLatestHeading')");
    expect(panelSource).toContain("t('wsComputedAt')");
    expect(panelSource).toContain("t('wsLatestEmpty')");
    expect(messages.en.wsLatestHeading).toBe('Most recent computational state');
    expect(messages.en.wsComputedAt).toBe('Computed at');
    expect(messages.en.wsLatestEmpty).toBe(
      'No computational state has been computed for this profile yet.',
    );
  });

  it('contains no prohibited measurement or detection wording', () => {
    for (const forbidden of [
      'How you feel',
      'What you feel',
      "The user's emotional state",
      'EMORA detects',
      'EMORA knows',
      'is emotionally',
      'your emotion',
      'true emotion',
      'diagnos',
      'clinically',
      'measures your',
    ]) {
      expect(panelSource).not.toContain(forbidden);
    }
  });

  it('renders no confidence, adjustment, or internal metadata fields', () => {
    expect(panelSource).not.toContain('confidence');
    expect(panelSource).not.toContain('confidenceAdjustment');
    expect(panelSource).not.toContain('state.metadata');
    expect(panelSource).not.toContain('.metadata');
  });

  it('resolves the disclosure through the presentation dictionary, not the server text', () => {
    expect(panelSource).toMatch(/from '.+server\/transitions\/disclosure'/);
    expect(panelSource).toContain('SCIENTIFIC_DISCLOSURE_CODE');
    // The canonical server text constant must not be imported for display;
    // the presentation dictionary carries the visible translation.
    expect(panelSource).not.toContain('SCIENTIFIC_DISCLOSURE_TEXT');
    expect(panelSource).not.toContain('EMORA output is a computational');
    expect(panelSource).toContain("t('disclosureText')");
    expect(messages.en.disclosureText).toContain(
      'computational, model-estimated emotional state',
    );
  });

  it('renders the persistent non-dismissible disclosure markup', () => {
    expect(panelSource).toContain('role="note"');
    expect(panelSource).toContain('data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}');
    // The accessible name follows the active UI language (M0 F-8).
    expect(panelSource).toContain("aria-label={t('disclosureLabel')}");
    expect(messages.en.disclosureLabel).toBe('Scientific disclosure');
  });
});
