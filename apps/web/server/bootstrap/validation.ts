import { z } from 'zod';

import { BootstrapError } from './errors';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const requestSchema = z.strictObject({
  organizationName: z.string(),
  organizationSlug: z.string(),
  projectName: z.string(),
  projectSlug: z.string(),
});

export interface AcceptedBootstrapRequest {
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly projectName: string;
  readonly projectSlug: string;
}

export function parseBootstrapRequest(value: unknown): AcceptedBootstrapRequest {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new BootstrapError('invalid_input');

  const organizationName = parsed.data.organizationName.trim();
  const projectName = parsed.data.projectName.trim();
  if (
    organizationName.length === 0 ||
    projectName.length === 0 ||
    !SLUG.test(parsed.data.organizationSlug) ||
    !SLUG.test(parsed.data.projectSlug)
  ) {
    throw new BootstrapError('invalid_input');
  }

  return {
    organizationName,
    organizationSlug: parsed.data.organizationSlug,
    projectName,
    projectSlug: parsed.data.projectSlug,
  };
}