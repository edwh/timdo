import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { Env } from '../index';
import * as organisationService from '../services/organisationService';
import {
  orgCreateSchema,
  orgInviteAcceptSchema,
  orgInviteSchema,
  orgMemberUpdateSchema,
  orgProjectCreateSchema,
  orgProjectUpdateSchema,
  orgUpdateSchema,
} from '../validators/organisationValidators';

// Permission failures throw AccessError, which the app-level onError turns into 403/404.
const organisationsApp = new Hono<{ Bindings: Env }>();

// GET /api/v2/organisations - Workspaces the user belongs to (personal first)
organisationsApp.get('/', async (c) => {
  const orgs = await organisationService.getUserOrganisations(c.get('db'), c.get('userId'));
  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
  return c.json(orgs);
});

// GET /api/v2/organisations/sharing - Everything the Sharing page needs
organisationsApp.get('/sharing', async (c) => {
  const overview = await organisationService.getSharingOverview(c.get('db'), c.get('userId'));
  return c.json(overview);
});

// POST /api/v2/organisations - Create a shared workspace
organisationsApp.post('/', zValidator('json', orgCreateSchema), async (c) => {
  const { name, slug } = c.req.valid('json');
  const org = await organisationService.createOrganisation(
    c.get('db'),
    c.get('userId'),
    name,
    slug
  );
  return c.json(org, 201);
});

// POST /api/v2/organisations/invites/accept - Accept invite by token
organisationsApp.post('/invites/accept', zValidator('json', orgInviteAcceptSchema), async (c) => {
  const { token } = c.req.valid('json');
  try {
    const result = await organisationService.acceptInvite(c.get('db'), c.get('userId'), token);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to accept invite' }, 400);
  }
});

// GET /api/v2/organisations/:id
organisationsApp.get('/:id', async (c) => {
  const org = await organisationService.getOrganisationById(
    c.get('db'),
    c.get('userId'),
    c.req.param('id')
  );
  if (!org) {
    return c.json({ error: 'Workspace not found or access denied' }, 404);
  }
  return c.json(org);
});

// PUT /api/v2/organisations/:id - Rename
organisationsApp.put('/:id', zValidator('json', orgUpdateSchema), async (c) => {
  const { name } = c.req.valid('json');
  const org = await organisationService.renameOrganisation(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    name
  );
  return c.json(org);
});

// DELETE /api/v2/organisations/:id - Delete an empty shared workspace
organisationsApp.delete('/:id', async (c) => {
  await organisationService.deleteOrganisation(c.get('db'), c.get('userId'), c.req.param('id'));
  return c.json({ message: 'Workspace deleted' });
});

// GET /api/v2/organisations/:id/members
organisationsApp.get('/:id/members', async (c) => {
  const orgId = c.req.param('id');
  const db = c.get('db');
  const org = await organisationService.getOrganisationById(db, c.get('userId'), orgId);
  if (!org) {
    return c.json({ error: 'Workspace not found or access denied' }, 404);
  }
  return c.json(await organisationService.getOrganisationMembers(db, orgId));
});

// GET /api/v2/organisations/:id/users/search?q= - Find people to add (2+ characters)
organisationsApp.get('/:id/users/search', async (c) => {
  const orgId = c.req.param('id');
  const db = c.get('db');
  const org = await organisationService.getOrganisationById(db, c.get('userId'), orgId);
  if (!org) {
    return c.json({ error: 'Workspace not found or access denied' }, 404);
  }
  return c.json(
    await organisationService.searchUsersForAutocomplete(
      db,
      c.get('userId'),
      c.req.query('q') || '',
      orgId
    )
  );
});

// POST /api/v2/organisations/:id/invites - Share with someone by email
organisationsApp.post('/:id/invites', zValidator('json', orgInviteSchema), async (c) => {
  const { email, role } = c.req.valid('json');
  const result = await organisationService.inviteMember(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    email,
    role
  );
  return c.json(result, result.status === 'already_member' ? 200 : 201);
});

// GET /api/v2/organisations/:id/invites - Pending invites (owners/admins)
organisationsApp.get('/:id/invites', async (c) => {
  return c.json(
    await organisationService.getOrganisationInvites(
      c.get('db'),
      c.get('userId'),
      c.req.param('id')
    )
  );
});

// DELETE /api/v2/organisations/:id/invites/:inviteId - Revoke a pending invite
organisationsApp.delete('/:id/invites/:inviteId', async (c) => {
  const ok = await organisationService.revokeInvite(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    c.req.param('inviteId')
  );
  if (!ok) {
    return c.json({ error: 'Invite not found' }, 404);
  }
  return c.json({ message: 'Invite revoked' });
});

// PUT /api/v2/organisations/:id/members/:userId - Change role
organisationsApp.put(
  '/:id/members/:userId',
  zValidator('json', orgMemberUpdateSchema),
  async (c) => {
    const { role } = c.req.valid('json');
    const updated = await organisationService.updateMemberRole(
      c.get('db'),
      c.get('userId'),
      c.req.param('id'),
      c.req.param('userId'),
      role
    );
    if (!updated) {
      return c.json({ error: 'Member not found' }, 404);
    }
    return c.json(updated);
  }
);

// DELETE /api/v2/organisations/:id/members/:userId - Remove someone (or leave, with your own id)
organisationsApp.delete('/:id/members/:userId', async (c) => {
  const removed = await organisationService.removeMember(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    c.req.param('userId')
  );
  if (!removed) {
    return c.json({ error: 'Member not found' }, 404);
  }
  return c.json({ message: 'Member removed' });
});

// GET /api/v2/organisations/:id/projects
organisationsApp.get('/:id/projects', async (c) => {
  return c.json(
    await organisationService.getOrganisationProjects(
      c.get('db'),
      c.get('userId'),
      c.req.param('id')
    )
  );
});

// POST /api/v2/organisations/:id/projects - Add a project to a workspace
organisationsApp.post('/:id/projects', zValidator('json', orgProjectCreateSchema), async (c) => {
  const { name, description } = c.req.valid('json');
  const project = await organisationService.addProject(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    name,
    description
  );
  return c.json(project, 201);
});

// PUT /api/v2/organisations/:id/projects/:projectId - Rename, archive, or move to another workspace
organisationsApp.put(
  '/:id/projects/:projectId',
  zValidator('json', orgProjectUpdateSchema),
  async (c) => {
    const project = await organisationService.updateProjectContainer(
      c.get('db'),
      c.get('userId'),
      c.req.param('id'),
      c.req.param('projectId'),
      c.req.valid('json')
    );
    return c.json(project);
  }
);

export default organisationsApp;
