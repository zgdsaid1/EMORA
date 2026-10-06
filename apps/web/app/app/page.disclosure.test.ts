import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { messages } from '../shell/messages';

/**
 * Slice 3 G2-C2 scientific boundary scan: wherever profile identity is
 * displayed or selected, the workspace must disclose that a profile is a
 * model-configuration record used for computation — never a measured
 * psychological profile, personality, diagnosis, or assessment of a person.
 * (G2-C3 is N/A for this surface: the page renders no new computational
 * output; the reused panels carry the canonical output disclosure.)
 *
 * M0: the disclosure renders on the minimal client presentation boundary
 * through the presentation dictionary — locale-keyed translations of the
 * frozen English semantic definition. Locale never changes the meaning.
 */

const workspaceSource = readFileSync(
  fileURLToPath(new URL('../workspace-view.tsx', import.meta.url)),
  'utf8',
);

describe('Slice 3 profile identity disclosure (G2-C2)', () => {
  it('renders the frozen profile identity disclosure on the workspace surface', () => {
    expect(workspaceSource).toContain(
      "aria-label={t('wsProfileIdentityDisclosureLabel')}",
    );
    expect(workspaceSource).toContain("{t('wsProfileIdentityDisclosure')}");
    expect(workspaceSource).toContain('role="note"');
    // The EN presentation preserves the previously frozen wording; FR/AR
    // translate the same semantic definition.
    expect(messages.en.wsProfileIdentityDisclosure).toContain(
      'This profile is a model-configuration record used for computation',
    );
    expect(messages.en.wsProfileIdentityDisclosure).toContain(
      'it is not a psychological assessment of a person.',
    );
    expect(messages.fr.wsProfileIdentityDisclosure).toContain(
      'pas une évaluation psychologique',
    );
    expect(messages.ar.wsProfileIdentityDisclosure).toContain(
      'ليس تقييمًا نفسيًا',
    );
  });

  it('contains no measured-personality or assessment wording', () => {
    for (const forbidden of [
      'true emotion',
      'measured anxiety',
      'measured trust',
      'personality assessment',
      'psychological profile',
      'diagnos',
      'clinically',
      'test result',
      'EMORA detects',
      'EMORA knows',
    ]) {
      expect(workspaceSource).not.toContain(forbidden);
    }
  });

  it('labels externalReference neutrally and never as a person name', () => {
    expect(workspaceSource).toContain("t('wsExternalReference')");
    expect(messages.en.wsExternalReference).toBe('External reference');
    expect(workspaceSource).not.toContain('Person ');
    expect(workspaceSource).not.toContain('Personality of');
  });
});
