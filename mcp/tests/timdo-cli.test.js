import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_TIMDO_BIN,
  getTimdoBinaryPath,
  runTimdoCli,
  buildListTasksArgs,
  buildAddTaskArgs,
  buildUpdateTaskArgs,
  buildListEpicsArgs,
  buildAddEpicArgs,
  buildUpdateEpicArgs,
  buildDeleteEpicArgs,
  buildGetEpicArgs,
  buildListGoalsArgs,
  buildAuditArgs,
  buildActivityArgs,
  buildWhoamiArgs,
  buildListWorkspacesArgs,
  buildGetWorkspaceArgs,
  buildShareWorkspaceArgs,
  buildUpdateMemberRoleArgs,
  buildRemoveMemberArgs,
  buildMoveProjectArgs,
} from '../src/timdo-cli.js';

test('DEFAULT_TIMDO_BIN is this repo\'s bin/timdo, found relative to the module', () => {
  const repoBin = resolve(dirname(fileURLToPath(import.meta.url)), '../../bin/timdo');
  assert.equal(DEFAULT_TIMDO_BIN, repoBin);
  assert.ok(existsSync(DEFAULT_TIMDO_BIN), 'bin/timdo exists');
});

test('getTimdoBinaryPath prefers TIMDO_BIN, then the repo binary', () => {
  assert.equal(getTimdoBinaryPath({ TIMDO_BIN: '/opt/custom/timdo' }), '/opt/custom/timdo');
  assert.equal(getTimdoBinaryPath({}), DEFAULT_TIMDO_BIN);
  const p = getTimdoBinaryPath();
  assert.ok(typeof p === 'string' && p.length > 0);
});

test('runTimdoCli passes --json and asUser (as TIMDO_AS) to the binary and parses JSON', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'timdo-mcp-test-'));
  const fake = join(dir, 'timdo');
  writeFileSync(
    fake,
    '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ argv: process.argv.slice(2), as: process.env.TIMDO_AS || null }));\n'
  );
  chmodSync(fake, 0o755);
  try {
    const out = await runTimdoCli(['whoami'], fake, { asUser: 'robin@example.com' });
    assert.deepEqual(out, { argv: ['--json', 'whoami'], as: 'robin@example.com' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildListTasksArgs formats status and filters correctly', () => {
  assert.deepEqual(buildListTasksArgs(), ['list', 'do']);
  assert.deepEqual(
    buildListTasksArgs({ status: 'awaiting', category: 'Acme Solar', epic: 'Battery', goal: 'revenue' }),
    ['list', 'awaiting', '-p', 'Acme Solar', '-e', 'Battery', '-g', 'revenue']
  );
  assert.deepEqual(buildListTasksArgs({ status: 'all' }), ['list', 'all']);
});

test('buildAddTaskArgs builds comprehensive add arguments', () => {
  const args = buildAddTaskArgs({
    project: 'Audit inverter voltage',
    reason: 'Prevent trip',
    priority: 8,
    status: 'awaiting',
    size: '**',
    awaitUntil: '2026-09-15',
    category: 'Acme Solar',
    epic: 'Battery',
    goal: 'revenue',
    thread: 'thread_xyz',
    notes: 'initial note',
  });
  assert.deepEqual(args, [
    'add',
    'Audit inverter voltage',
    '-r',
    'Prevent trip',
    '-s',
    'awaiting',
    '--priority',
    '8',
    '--size',
    '**',
    '-p',
    'Acme Solar',
    '-e',
    'Battery',
    '-g',
    'revenue',
    '--await-until',
    '2026-09-15',
    '--thread',
    'thread_xyz',
    '-n',
    'initial note',
  ]);
});

test('buildAddTaskArgs throws when project title is missing', () => {
  assert.throws(() => buildAddTaskArgs(), /Task title \(project\) is required\./);
  assert.throws(() => buildAddTaskArgs({ project: '' }), /Task title \(project\) is required\./);
});

test('buildUpdateTaskArgs formats shorthand status flags and attributes', () => {
  const args = buildUpdateTaskArgs({
    id: 'ea9f',
    status: 'done',
    priority: 9,
  });
  assert.deepEqual(args, ['update', 'ea9f', '--done', '--priority', '9']);

  const argsCustomStatus = buildUpdateTaskArgs({
    id: 'ea9f',
    status: 'custom_status',
    project: 'Renamed',
    reason: 'Updated reason',
    size: '***',
    category: 'Personal',
    epic: 'Fitness',
    goal: 'health',
    awaitUntil: '2026-10-01',
    thread: 't123',
    notes: 'updated note',
  });
  assert.deepEqual(argsCustomStatus, [
    'update',
    'ea9f',
    '--project',
    'Renamed',
    '-r',
    'Updated reason',
    '-s',
    'custom_status',
    '--size',
    '***',
    '-p',
    'Personal',
    '-e',
    'Fitness',
    '-g',
    'health',
    '--await-until',
    '2026-10-01',
    '--thread',
    't123',
    '-n',
    'updated note',
  ]);

  for (const status of ['done', 'do', 'delay', 'delegate', 'awaiting']) {
    assert.deepEqual(buildUpdateTaskArgs({ id: '123', status }), ['update', '123', `--${status}`]);
  }
});

test('buildUpdateTaskArgs throws when id is missing', () => {
  assert.throws(() => buildUpdateTaskArgs(), /Task ID is required for update\./);
  assert.throws(() => buildUpdateTaskArgs({ id: '' }), /Task ID is required for update\./);
});

test('buildListEpicsArgs formats epic arguments', () => {
  assert.deepEqual(buildListEpicsArgs(), ['epic', 'list']);
  assert.deepEqual(buildListEpicsArgs({ category: 'Acme Solar' }), ['epic', 'list', '-p', 'Acme Solar']);
});

test('buildAddEpicArgs formats epic arguments and validates title', () => {
  const args = buildAddEpicArgs({
    title: 'Battery Expansion',
    category: 'Acme Solar',
    goal: 'revenue',
    description: 'Expanding storage capacity',
    status: 'active',
  });
  assert.deepEqual(args, [
    'epic',
    'add',
    'Battery Expansion',
    '-p',
    'Acme Solar',
    '-g',
    'revenue',
    '-d',
    'Expanding storage capacity',
    '--status',
    'active',
  ]);

  assert.throws(() => buildAddEpicArgs(), /Epic title is required\./);
  assert.throws(() => buildAddEpicArgs({ title: '' }), /Epic title is required\./);
});

test('buildUpdateEpicArgs formats update flags correctly', () => {
  const args = buildUpdateEpicArgs({
    id: 'epic-123',
    title: 'Updated Title',
    category: 'Acme Solar',
    status: 'completed',
  });
  assert.deepEqual(args, [
    'epic',
    'update',
    'epic-123',
    '--title',
    'Updated Title',
    '-p',
    'Acme Solar',
    '--status',
    'completed',
  ]);
  assert.throws(() => buildUpdateEpicArgs(), /Epic id or title is required for update\./);
});

test('buildDeleteEpicArgs formats delete args', () => {
  assert.deepEqual(buildDeleteEpicArgs({ id: 'epic-123' }), ['epic', 'delete', 'epic-123']);
  assert.throws(() => buildDeleteEpicArgs(), /Epic id or title is required for delete\./);
});

test('buildGetEpicArgs formats get args', () => {
  assert.deepEqual(buildGetEpicArgs({ id: 'epic-123' }), ['epic', 'get', 'epic-123']);
  assert.throws(() => buildGetEpicArgs(), /Epic id or title is required\./);
});

test('buildListGoalsArgs formats goal arguments', () => {
  assert.deepEqual(buildListGoalsArgs(), ['goal', 'list']);
  assert.deepEqual(buildListGoalsArgs({ type: 'annual' }), ['goal', 'list', '-t', 'annual']);
});

test('buildListTasksArgs formats unlinked and hierarchy filters', () => {
  assert.deepEqual(
    buildListTasksArgs({ noEpic: true, noGoal: true, noCategory: true, unlinked: 'any' }),
    ['list', 'do', '--no-epic', '--no-goal', '--no-category', '--unlinked', 'any']
  );
});

test('buildAuditArgs returns audit subcommand', () => {
  assert.deepEqual(buildAuditArgs(), ['audit']);
});

test('runTimdoCli handles missing or invalid binaries gracefully', async () => {
  await assert.rejects(
    async () => {
      await runTimdoCli(['list'], '/non/existent/bin/path');
    },
    /timdo CLI error:/
  );
});

test('buildListTasksArgs adds multi-user filters after the existing ones', () => {
  assert.deepEqual(
    buildListTasksArgs({ status: 'do', category: 'Acme Solar', workspace: 'Acme', assignee: 'robin' }),
    ['list', 'do', '-p', 'Acme Solar', '--workspace', 'Acme', '--assignee', 'robin']
  );
  assert.deepEqual(buildListTasksArgs({ mine: true }), ['list', 'do', '--mine']);
  assert.deepEqual(buildListTasksArgs({ unassigned: true, shared: true }), ['list', 'do', '--unassigned', '--shared']);
  assert.deepEqual(buildListTasksArgs({ projectId: 'SOL', assignee: 'me', mine: true }), [
    'list',
    'do',
    '--project-id',
    'SOL',
    '--assignee',
    'me',
  ]);
});

test('buildAddTaskArgs and buildUpdateTaskArgs pass assignment and exact project', () => {
  assert.deepEqual(buildAddTaskArgs({ project: 'Fix inverter', category: 'Acme Solar', assignTo: 'robin@example.com' }), [
    'add',
    'Fix inverter',
    '-p',
    'Acme Solar',
    '--assign',
    'robin@example.com',
  ]);
  assert.deepEqual(buildAddTaskArgs({ project: 'Keyed', projectId: 'SOL' }), ['add', 'Keyed', '--project-id', 'SOL']);
  assert.deepEqual(buildUpdateTaskArgs({ id: 'ab12', claim: true }), ['update', 'ab12', '--claim']);
  assert.deepEqual(buildUpdateTaskArgs({ id: 'ab12', unassign: true }), ['update', 'ab12', '--unassign']);
  assert.deepEqual(buildUpdateTaskArgs({ id: 'ab12', assignTo: 'none', projectId: 'MIG' }), [
    'update',
    'ab12',
    '--project-id',
    'MIG',
    '--assign',
    'none',
  ]);
});

test('epic and audit builders accept workspace, project and scope options', () => {
  assert.deepEqual(buildListEpicsArgs({ workspace: 'Acme' }), ['epic', 'list', '--workspace', 'Acme']);
  assert.deepEqual(buildAddEpicArgs({ title: 'T', projectId: 'SOL' }), ['epic', 'add', 'T', '--project-id', 'SOL']);
  assert.deepEqual(buildUpdateEpicArgs({ id: 'e1', projectId: 'SOL' }), ['epic', 'update', 'e1', '--project-id', 'SOL']);
  assert.deepEqual(buildAuditArgs({ all: true }), ['audit', '--all']);
});

test('collaboration builders produce workspace and activity commands', () => {
  assert.deepEqual(buildActivityArgs({ taskId: 'ab12', project: 'SOL', workspace: 'MD', limit: 5 }), [
    'activity',
    '--task',
    'ab12',
    '--project',
    'SOL',
    '--workspace',
    'MD',
    '-n',
    '5',
  ]);
  assert.deepEqual(buildActivityArgs(), ['activity']);
  assert.deepEqual(buildWhoamiArgs(), ['whoami']);
  assert.deepEqual(buildListWorkspacesArgs(), ['workspace', 'list']);
  assert.deepEqual(buildGetWorkspaceArgs({ workspace: 'MD' }), ['workspace', 'show', 'MD']);
  assert.deepEqual(buildShareWorkspaceArgs({ workspace: 'MD', email: 'e@x.org' }), [
    'workspace',
    'share',
    'MD',
    'e@x.org',
    '--role',
    'member',
  ]);
  assert.throws(() => buildShareWorkspaceArgs({ workspace: 'MD', email: 'e@x.org', role: 'owner' }), /admin, member, viewer/);
  assert.deepEqual(buildUpdateMemberRoleArgs({ workspace: 'MD', member: 'robin', role: 'viewer' }), [
    'workspace',
    'role',
    'MD',
    'robin',
    'viewer',
  ]);
  assert.throws(() => buildUpdateMemberRoleArgs({ workspace: 'MD', member: 'robin', role: 'boss' }), /owner, admin/);
  assert.deepEqual(buildRemoveMemberArgs({ workspace: 'MD', member: 'robin' }), ['workspace', 'remove', 'MD', 'robin', '--yes']);
  assert.deepEqual(buildMoveProjectArgs({ project: 'Acme Solar', workspace: 'MD' }), [
    'workspace',
    'move-project',
    'Acme Solar',
    'MD',
    '--yes',
  ]);
  assert.throws(() => buildMoveProjectArgs({ project: 'Acme Solar' }), /required/);
});
