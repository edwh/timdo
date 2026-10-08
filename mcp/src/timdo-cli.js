import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** bin/timdo in this repository, found relative to this file (mcp/src/ -> ../../bin/timdo). */
export const DEFAULT_TIMDO_BIN = resolve(dirname(fileURLToPath(import.meta.url)), '../../bin/timdo');

/**
 * Locate the timdo executable: $TIMDO_BIN if set, else this repo's bin/timdo, else "timdo" on PATH.
 */
export function getTimdoBinaryPath(env = process.env) {
  if (env.TIMDO_BIN) return env.TIMDO_BIN;
  if (existsSync(DEFAULT_TIMDO_BIN)) return DEFAULT_TIMDO_BIN;
  return 'timdo';
}

/**
 * Execute bin/timdo with arguments and parse JSON stdout.
 * options.asUser: act as another TimDo account by email (sets TIMDO_AS, which the
 * CLI sends as X-Timdo-User). Only the account owner's secret can act as someone
 * else; with a personal token (bin/timdo login) the API refuses any other email.
 * Leave it out to act as whoever the CLI is signed in as.
 */
export async function runTimdoCli(subcommandArgs, binPath = getTimdoBinaryPath(), options = {}) {
  const fullArgs = ['--json', ...subcommandArgs];
  const env = { ...process.env };
  if (options.asUser) env.TIMDO_AS = String(options.asUser);
  try {
    const { stdout } = await execFileAsync(binPath || getTimdoBinaryPath(), fullArgs, {
      maxBuffer: 10 * 1024 * 1024,
      env,
    });
    const trimmed = stdout.trim();
    if (!trimmed) {
      return { success: true };
    }
    return JSON.parse(trimmed);
  } catch (error) {
    const stderr = error.stderr ? error.stderr.trim() : '';
    const message = stderr || error.message || 'Unknown timdo CLI error';
    throw new Error(`timdo CLI error: ${message}`);
  }
}

/**
 * Build CLI arguments for task listing.
 */
export function buildListTasksArgs({
  status = 'do',
  category,
  epic,
  goal,
  customer,
  tag,
  relatedTo,
  noEpic,
  noGoal,
  noCategory,
  unlinked,
  assignee,
  workspace,
  projectId,
  mine,
  unassigned,
  shared,
} = {}) {
  const args = ['list', status];
  if (category) args.push('-p', category);
  if (epic) args.push('-e', epic);
  if (goal) args.push('-g', goal);
  if (customer) args.push('--customer', customer);
  if (tag) args.push('--tag', tag);
  if (relatedTo) args.push('--related-to', relatedTo);
  if (noEpic) args.push('--no-epic');
  if (noGoal) args.push('--no-goal');
  if (noCategory) args.push('--no-category');
  if (unlinked) args.push('--unlinked', unlinked);
  if (workspace) args.push('--workspace', workspace);
  if (projectId) args.push('--project-id', projectId);
  if (assignee) args.push('--assignee', assignee);
  else if (mine) args.push('--mine');
  else if (unassigned) args.push('--unassigned');
  if (shared) args.push('--shared');
  return args;
}

/**
 * Build CLI arguments for alignment & hygiene audit.
 */
export function buildAuditArgs({ all } = {}) {
  return all ? ['audit', '--all'] : ['audit'];
}

/**
 * Build CLI arguments for task creation.
 */
export function buildAddTaskArgs({
  project,
  reason,
  status,
  priority,
  size,
  category,
  epic,
  goal,
  customer,
  tags,
  linkTaskId,
  linkType,
  awaitUntil,
  thread,
  notes,
  projectId,
  assignTo,
} = {}) {
  if (!project) throw new Error('Task title (project) is required.');
  const args = ['add', project];
  if (reason) args.push('-r', reason);
  if (status) args.push('-s', status);
  if (priority !== undefined) args.push('--priority', String(priority));
  if (size) args.push('--size', size);
  if (category) args.push('-p', category);
  if (epic) args.push('-e', epic);
  if (goal) args.push('-g', goal);
  if (customer) args.push('--customer', customer);
  if (tags) args.push('--tags', Array.isArray(tags) ? tags.join(',') : tags);
  if (awaitUntil) args.push('--await-until', awaitUntil);
  if (thread) args.push('--thread', thread);
  if (notes) args.push('-n', notes);
  if (projectId) args.push('--project-id', projectId);
  if (assignTo) args.push('--assign', assignTo);
  return args;
}

/**
 * Build CLI arguments for task update.
 */
export function buildUpdateTaskArgs({
  id,
  project,
  reason,
  status,
  priority,
  category,
  epic,
  goal,
  customer,
  tags,
  linkTaskId,
  linkType,
  size,
  awaitUntil,
  thread,
  notes,
  projectId,
  assignTo,
  claim,
  unassign,
} = {}) {
  if (!id) throw new Error('Task ID is required for update.');
  const args = ['update', id];
  if (project) args.push('--project', project);
  if (reason) args.push('-r', reason);
  if (status) {
    if (['done', 'do', 'delay', 'delegate', 'awaiting'].includes(status)) {
      args.push(`--${status}`);
    } else {
      args.push('-s', status);
    }
  }
  if (priority !== undefined) args.push('--priority', String(priority));
  if (size) args.push('--size', size);
  if (category) args.push('-p', category);
  if (epic) args.push('-e', epic);
  if (goal) args.push('-g', goal);
  if (customer) args.push('--customer', customer);
  if (tags) args.push('--tags', Array.isArray(tags) ? tags.join(',') : tags);
  if (awaitUntil) args.push('--await-until', awaitUntil);
  if (thread) args.push('--thread', thread);
  if (notes) args.push('-n', notes);
  if (projectId) args.push('--project-id', projectId);
  if (assignTo) args.push('--assign', assignTo);
  else if (claim) args.push('--claim');
  else if (unassign) args.push('--unassign');
  return args;
}

export function buildSearchTasksArgs({ query, includeDone, customer } = {}) {
  if (!query) throw new Error('Search query is required.');
  const args = ['search', query];
  if (includeDone) args.push('--all');
  if (customer) args.push('--customer', customer);
  return args;
}

export function buildListCustomersArgs() {
  return ['customers'];
}

export function buildLinkTasksArgs({ taskId, targetTaskId, relation = 'relates_to', reason } = {}) {
  if (!taskId || !targetTaskId) throw new Error('Both taskId and targetTaskId are required.');
  const args = ['link', taskId, targetTaskId, '--type', relation];
  if (reason) args.push('--reason', reason);
  return args;
}

export function buildUnlinkTasksArgs({ taskId, targetTaskId } = {}) {
  if (!taskId || !targetTaskId) throw new Error('Both taskId and targetTaskId are required.');
  return ['unlink', taskId, targetTaskId];
}

/**
 * Build CLI arguments for epics.
 */
export function buildListEpicsArgs({ category, workspace } = {}) {
  const args = ['epic', 'list'];
  if (category) args.push('-p', category);
  if (workspace) args.push('--workspace', workspace);
  return args;
}

export function buildAddEpicArgs({ title, category, goal, description, status, projectId } = {}) {
  if (!title) throw new Error('Epic title is required.');
  const args = ['epic', 'add', title];
  if (category) args.push('-p', category);
  if (goal) args.push('-g', goal);
  if (description) args.push('-d', description);
  if (status) args.push('--status', status);
  if (projectId) args.push('--project-id', projectId);
  return args;
}

export function buildUpdateEpicArgs({ id, title, category, goal, description, status, projectId } = {}) {
  if (!id) throw new Error('Epic id or title is required for update.');
  const args = ['epic', 'update', id];
  if (title) args.push('--title', title);
  if (category !== undefined) args.push('-p', category);
  if (goal !== undefined) args.push('-g', goal);
  if (description !== undefined) args.push('-d', description);
  if (status) args.push('--status', status);
  if (projectId) args.push('--project-id', projectId);
  return args;
}

export function buildDeleteEpicArgs({ id } = {}) {
  if (!id) throw new Error('Epic id or title is required for delete.');
  return ['epic', 'delete', id];
}

export function buildGetEpicArgs({ id } = {}) {
  if (!id) throw new Error('Epic id or title is required.');
  return ['epic', 'get', id];
}

/**
 * Build CLI arguments for goals.
 */
export function buildListGoalsArgs({ type } = {}) {
  const args = ['goal', 'list'];
  if (type) args.push('-t', type);
  return args;
}

/**
 * Activity log: who did what, newest first.
 */
export function buildActivityArgs({ taskId, epic, project, workspace, limit } = {}) {
  const args = ['activity'];
  if (taskId) args.push('--task', taskId);
  if (epic) args.push('--epic', epic);
  if (project) args.push('--project', project);
  if (workspace) args.push('--workspace', workspace);
  if (limit !== undefined && limit !== null && limit !== '') args.push('-n', String(limit));
  return args;
}

/**
 * Workspaces and sharing.
 */
export function buildWhoamiArgs() {
  return ['whoami'];
}

export function buildListWorkspacesArgs() {
  return ['workspace', 'list'];
}

export function buildGetWorkspaceArgs({ workspace } = {}) {
  if (!workspace) throw new Error('Workspace name or id is required.');
  return ['workspace', 'show', workspace];
}

const SHARE_ROLES = ['admin', 'member', 'viewer'];
const MEMBER_ROLES = ['owner', 'admin', 'member', 'viewer'];

export function buildShareWorkspaceArgs({ workspace, email, role = 'member' } = {}) {
  if (!workspace || !email) throw new Error('Both workspace and email are required.');
  if (!SHARE_ROLES.includes(role)) throw new Error('role must be one of admin, member, viewer.');
  return ['workspace', 'share', workspace, email, '--role', role];
}

export function buildUpdateMemberRoleArgs({ workspace, member, role } = {}) {
  if (!workspace || !member || !role) throw new Error('workspace, member and role are required.');
  if (!MEMBER_ROLES.includes(role)) throw new Error('role must be one of owner, admin, member, viewer.');
  return ['workspace', 'role', workspace, member, role];
}

export function buildRemoveMemberArgs({ workspace, member } = {}) {
  if (!workspace || !member) throw new Error('Both workspace and member are required.');
  return ['workspace', 'remove', workspace, member, '--yes'];
}

export function buildMoveProjectArgs({ project, workspace } = {}) {
  if (!project || !workspace) throw new Error('Both project and workspace are required.');
  return ['workspace', 'move-project', project, workspace, '--yes'];
}
