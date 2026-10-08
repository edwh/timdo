import { z } from 'zod';

export const orgRoleEnum = z.enum(['owner', 'admin', 'member', 'viewer']);
export type OrgRole = z.infer<typeof orgRoleEnum>;

export const orgCreateSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(80),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with dashes')
    .optional(),
});

export type OrgCreateInput = z.input<typeof orgCreateSchema>;
export type OrgCreatePayload = z.infer<typeof orgCreateSchema>;

export const orgUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(80),
});

export const orgInviteSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export type OrgInviteInput = z.input<typeof orgInviteSchema>;
export type OrgInvitePayload = z.infer<typeof orgInviteSchema>;

export const orgMemberUpdateSchema = z.object({
  role: orgRoleEnum,
});

export type OrgMemberUpdatePayload = z.infer<typeof orgMemberUpdateSchema>;

export const orgInviteAcceptSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type OrgInviteAcceptPayload = z.infer<typeof orgInviteAcceptSchema>;

export const orgProjectCreateSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(80),
  description: z.string().nullable().optional(),
});

export const orgProjectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
  /** Move the project to this workspace */
  orgId: z.string().optional(),
});
