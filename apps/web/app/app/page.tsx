import { AuthenticationError, requireAuth } from '@emora/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  discoverAuthorizedProfiles,
  discoverAuthorizedProjects,
} from '../../server/discovery';
import {
  ensureControlledFixture,
  grantControlledMembership,
} from '../../server/transitions/fixture';
import { validateReturnTarget } from '../session-recovery';
import { ContextReporter } from '../shell/application-shell';
import { WorkspaceView } from '../workspace-view';

export const dynamic = 'force-dynamic';

export default async function ProtectedAppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  let session: Awaited<ReturnType<typeof requireAuth>> | undefined;
  try {
    session = await requireAuth(await headers());
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
  }

  if (!session) {
    const returnParams = new URLSearchParams();
    for (const key of ['projectId', 'profileId']) {
      const value = query[key];
      if (typeof value === 'string') returnParams.set(key, value);
    }
    const queryString = returnParams.toString();
    const returnTarget = validateReturnTarget(
      queryString ? `/app?${queryString}` : '/app',
    );
    redirect(`/login?callbackUrl=${encodeURIComponent(returnTarget)}`);
  }

  // Production workspace discovery: membership-scoped, server-derived.
  let projects = await discoverAuthorizedProjects(session.user.id);

  // Controlled development/demo fixture only. Development environments only:
  // test, production, staging, and preview never provision, and nothing is
  // provisioned when a workspace already exists.
  if (projects.length === 0 && process.env.NODE_ENV === 'development') {
    const fixture = await ensureControlledFixture();
    await grantControlledMembership(fixture, session.user.id);
    projects = await discoverAuthorizedProjects(session.user.id);
  }

  const requestedProjectId =
    typeof query.projectId === 'string' ? query.projectId : undefined;
  const requestedProfileId =
    typeof query.profileId === 'string' ? query.profileId : undefined;

  const project =
    projects.find((candidate) => candidate.projectId === requestedProjectId) ??
    projects[0];

  const profiles = project
    ? await discoverAuthorizedProfiles(session.user.id, project.projectId)
    : [];

  const profile =
    profiles.find((candidate) => candidate.profileId === requestedProfileId) ??
    profiles[0];

  return (
    <>
      <ContextReporter
        project={project ? { name: project.name, id: project.projectId } : undefined}
        profile={profile ? { name: profile.externalReference, id: profile.profileId } : undefined}
      />
      {/*
        Minimal client presentation boundary: the server component resolves
        authentication, discovery, and selection, then passes only
        serializable identity data for localized rendering. No locale data
        crosses this boundary, and the server stays authoritative.
      */}
      <WorkspaceView
        sessionEmail={session.user.email}
        projects={projects.map((candidate) => ({
          projectId: candidate.projectId,
          name: candidate.name,
        }))}
        profiles={profiles.map((candidate) => ({
          profileId: candidate.profileId,
          externalReference: candidate.externalReference,
        }))}
        project={
          project
            ? { projectId: project.projectId, name: project.name }
            : undefined
        }
        profile={
          profile
            ? {
                profileId: profile.profileId,
                externalReference: profile.externalReference,
              }
            : undefined
        }
      />
    </>
  );
}
