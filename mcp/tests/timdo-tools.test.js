import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIMDO_TOOLS, TIMDO_ARG_BUILDERS, handleTimdoTool } from '../src/timdo-tools.js';

const ORIGINAL_TOOLS = [
  'timdo_list_tasks',
  'timdo_get_task',
  'timdo_add_task',
  'timdo_update_task',
  'timdo_add_note',
  'timdo_list_notes',
  'timdo_audit',
  'timdo_search_tasks',
  'timdo_delete_task',
  'timdo_list_epics',
  'timdo_add_epic',
  'timdo_update_epic',
  'timdo_delete_epic',
  'timdo_get_epic',
  'timdo_list_goals',
  'timdo_merge_tasks',
  'timdo_list_customers',
  'timdo_link_tasks',
  'timdo_unlink_tasks',
];

const NEW_TOOLS = [
  'timdo_activity',
  'timdo_whoami',
  'timdo_list_workspaces',
  'timdo_get_workspace',
  'timdo_share_workspace',
  'timdo_update_member_role',
  'timdo_remove_member',
  'timdo_move_project',
];

const byName = Object.fromEntries(TIMDO_TOOLS.map((t) => [t.name, t]));

test('every original and new TimDo tool is defined, with a builder', () => {
  for (const name of [...ORIGINAL_TOOLS, ...NEW_TOOLS]) {
    assert.ok(byName[name], `${name} is defined`);
    assert.ok(TIMDO_ARG_BUILDERS[name], `${name} has a builder`);
  }
  assert.equal(TIMDO_TOOLS.length, ORIGINAL_TOOLS.length + NEW_TOOLS.length);
});

test('original parameters are kept for backward compatibility', () => {
  const props = (n) => Object.keys(byName[n].inputSchema.properties);
  for (const p of ['status', 'category', 'epic', 'goal', 'customer', 'tag', 'relatedTo', 'noEpic', 'noGoal', 'noCategory', 'unlinked']) {
    assert.ok(props('timdo_list_tasks').includes(p), `list_tasks keeps ${p}`);
  }
  for (const p of ['project', 'reason', 'status', 'priority', 'size', 'category', 'epic', 'goal', 'customer', 'tags', 'linkTaskId', 'linkType', 'awaitUntil', 'thread', 'notes']) {
    assert.ok(props('timdo_add_task').includes(p), `add_task keeps ${p}`);
  }
  assert.deepEqual(byName.timdo_add_task.inputSchema.required, ['project']);
  assert.deepEqual(byName.timdo_update_task.inputSchema.required, ['id']);
  assert.deepEqual(byName.timdo_merge_tasks.inputSchema.required, ['sourceId', 'targetId']);
});

test('multi-user parameters and asUser are exposed', () => {
  const props = (n) => byName[n].inputSchema.properties;
  assert.ok(props('timdo_list_tasks').assignee);
  assert.ok(props('timdo_list_tasks').workspace);
  assert.ok(props('timdo_add_task').assignTo);
  assert.ok(props('timdo_update_task').assignTo);
  assert.ok(props('timdo_update_task').claim);
  for (const t of TIMDO_TOOLS) assert.ok(t.inputSchema.properties.asUser, `${t.name} accepts asUser`);
  assert.match(byName.timdo_list_workspaces.description, /viewer/);
  for (const t of TIMDO_TOOLS) assert.ok(!t.description.includes('\u2014'), `${t.name} has no em-dash`);
});

test('handleTimdoTool runs the CLI with --yes for drastic actions and passes asUser', async () => {
  const calls = [];
  const fakeRun = async (args, bin, options) => {
    calls.push({ args, options });
    return { ok: true };
  };
  const res = await handleTimdoTool('timdo_remove_member', { workspace: 'MD', member: 'robin', asUser: 'x@y.z' }, fakeRun);
  assert.deepEqual(calls[0].args, ['workspace', 'remove', 'MD', 'robin', '--yes']);
  assert.deepEqual(calls[0].options, { asUser: 'x@y.z' });
  assert.equal(JSON.parse(res.content[0].text).ok, true);

  await handleTimdoTool('timdo_list_tasks', { assignee: 'me' }, fakeRun);
  assert.deepEqual(calls[1].args, ['list', 'do', '--assignee', 'me']);
  assert.deepEqual(calls[1].options, {});

  assert.equal(await handleTimdoTool('not_a_timdo_tool', {}, fakeRun), null);
});

test('handleTimdoTool links a new task when linkTaskId is given', async () => {
  const calls = [];
  const fakeRun = async (args) => {
    calls.push(args);
    return args[0] === 'add' ? { id: 'new-id' } : { ok: true };
  };
  await handleTimdoTool('timdo_add_task', { project: 'T', category: 'Acme Solar', linkTaskId: 'ab12', linkType: 'blocks' }, fakeRun);
  assert.deepEqual(calls[1], ['link', 'new-id', 'ab12', '--type', 'blocks']);
});

test('handleTimdoTool surfaces CLI errors such as view-only access', async () => {
  const fakeRun = async () => {
    throw new Error('timdo CLI error: View only: you have view-only access to "Acme Solar"');
  };
  await assert.rejects(() => handleTimdoTool('timdo_update_task', { id: 'ab12', status: 'done' }, fakeRun), /View only/);
});

test('asUser explains that personal tokens can only name yourself', () => {
  const desc = TIMDO_TOOLS[0].inputSchema.properties.asUser.description;
  assert.match(desc, /owner/);
  assert.match(desc, /personal token/);
});

test('tool text has no personal paths and speaks to any user, not one named person', () => {
  const text = JSON.stringify(TIMDO_TOOLS);
  assert.ok(!text.includes('/home/'), 'no home directory paths');
  assert.ok(!/\bTim\b/.test(text), 'no references to one named account owner');
  for (const m of text.match(/[\w.+-]+@[\w.-]+/g) || []) assert.match(m, /@example\.com$/, `example email ${m}`);
});
