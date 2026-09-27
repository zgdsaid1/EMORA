import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A3 profile read/select/use integration verification (source-scan
 * convention, matching the existing page/wording tests). The workspace page is
 * a server component: profiles are read through the existing membership-scoped
 * discovery service (the same contract as the project-scoped GET endpoint),
 * selection is server-derived URL state, and the selected profile feeds the
 * existing latest-state/transition panels by reference only. No second read
 * path, no client-side ownership assumptions, no new model pathway.
 */

const pageSource = readFileSync(
  fileURLToPath(new URL('./page.tsx', import.meta.url)),
  'utf8',
);

const discoverySource = readFileSync(
  fileURLToPath(new URL('../../server/discovery.ts', import.meta.url)),
  'utf8',
);

describe('A3 profile read integration', () => {
  it('reads profiles through the existing membership-scoped discovery service', () => {
    expect(pageSource).toContain(
      'discoverAuthorizedProfiles(session.user.id, project.projectId)',
    );
    expect(discoverySource).toContain(
      "requireProjectAccess(userId, projectId, 'VIEWER')",
    );
    expect(discoverySource).toContain('listProjectProfiles');
  });

  it('scopes the profile list to the active project only', () => {
    expect(discoverySource).toContain('listProjectProfiles({');
    expect(discoverySource).toContain('projectId,');
    expect(pageSource).toContain(
      'discoverAuthorizedProfiles(session.user.id, project.projectId)',
    );
  });

  it('queries no database directly and creates no second read path', () => {
    // Server service layer only — the same contract as the existing GET route.
    expect(discoverySource).toContain("from './profiles/service'");
    expect(pageSource).not.toContain('@emora/database');
    expect(pageSource).not.toContain('fetch(');
    expect(pageSource).not.toContain("'/api/");
  });
});

describe('A3 profile selection', () => {
  it('allows selecting one profile by reference and marks the selection', () => {
    expect(pageSource).toContain(
      'href={`?projectId=${project?.projectId}&profileId=${candidate.profileId}`}',
    );
    expect(pageSource).toContain('requestedProfileId');
    expect(pageSource).toContain(
      'profiles.find((candidate) => candidate.profileId === requestedProfileId)',
    );
    expect(pageSource).toContain('aria-current=');
  });

  it('keeps the selected profile explicitly bound to the active project', () => {
    // Selection preserves the project in the URL and every consumer receives
    // the server-derived (projectId, profileId) pair together.
    expect(pageSource).toContain(
      'href={`?projectId=${project?.projectId}&profileId=${candidate.profileId}`}',
    );
    expect(pageSource).toContain('projectId={project.projectId}');
    expect(pageSource).toContain('profileId={profile.profileId}');
    expect(pageSource).toContain(
      'Project {project.projectId} · profile {profile.profileId}',
    );
  });
});

describe('A3 profile list states', () => {
  it('renders a safe empty state with a path back to onboarding', () => {
    expect(pageSource).toContain(
      'No profile record is available in this project yet',
    );
    expect(pageSource).toContain('Create one');
    expect(pageSource).toContain(
      '<ProfileOnboardingForm projectId={project.projectId} />',
    );
  });

  it('distinguishes multiple profiles by external reference and id', () => {
    expect(pageSource).toContain(
      'external reference {candidate.externalReference}',
    );
    expect(pageSource).toContain('candidate.profileId');
    expect(pageSource).toContain('profiles.map((candidate) =>');
  });
});


describe('A3 error safety and ownership', () => {
  it('renders errors safely without internal details', () => {
    // Authorization failures collapse to the controlled empty state (never an
    // existence oracle); only infrastructure failures rethrow server-side.
    expect(discoverySource).toContain(
      'if (error instanceof AuthorizationError) return [];',
    );
    for (const forbidden of [
      'error.stack',
      'error.message',
      'console.error',
      'internal_error',
      'SQLSTATE',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  it('assumes no client-side profile ownership', () => {
    // The workspace is a server component: selection is resolved from the
    // server-derived, project-scoped profile list. Discovery never authorizes
    // by itself and re-derives access through requireProjectAccess.
    expect(pageSource).not.toContain("'use client'");
    expect(discoverySource).toContain('never authorizes anything by itself');
    expect(discoverySource).toContain('requireProjectAccess');
  });
});

describe('A3 boundary and compatibility', () => {
  it('preserves the frozen disclosure and introduces no measurement claims', () => {
    expect(pageSource).toContain('PROFILE_IDENTITY_DISCLOSURE');
    expect(pageSource).toContain('aria-label="Profile identity disclosure"');
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
      'Person ',
      'Personality of',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  it('keeps A1/A2 and the existing use flow compatible', () => {
    // A2 onboarding entry point remains mounted.
    expect(pageSource).toContain('<ProfileOnboardingForm');
    // Existing use flow: the selected profile reference feeds the existing
    // latest-state panel and transition form (no new model pathway).
    expect(pageSource).toContain('<LatestStatePanel');
    expect(pageSource).toContain('<TransitionForm');
    expect(pageSource).toContain('profileId={profile.profileId}');
    expect(pageSource).toContain('No profile is selected');
    expect(pageSource).toContain(
      'Select a profile above to compute and read computational states',
    );
  });
});
