/**
 * projectService (the `/projects` task API) against real SQL (node:sqlite + the live D1 schema).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessError } from '../services/accessService';
import { getActivity } from '../services/activityService';
import * as epicService from '../services/epicService';
import * as orgService from '../services/organisationService';
import * as projectService from '../services/projectService';
import { createTestDb, ROBIN, seedCollaboration, STRANGER, TIM } from './helpers/testDb';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('projectService', () => {
  let db: any;
  let raw: any;

  beforeEach(() => {
    ({ db, raw } = createTestDb());
    seedCollaboration(raw);
    raw.exec(`
      INSERT INTO Goals (id, user_id, type, title) VALUES
        ('g-tim', '${TIM}', 'aim', 'Tim aim'),
        ('g-tim-2', '${TIM}', 'focus', 'Tim focus'),
        ('g-robin', '${ROBIN}', 'aim', 'Robin aim');
    `);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function newTask(userId: string, n: number, category: string, extra: any = {}) {
    return projectService.createProject(db, userId, {
      id: uuid(n),
      project: `Task ${n}`,
      status: 'do',
      priority: 5,
      size: '***',
      category,
      ...extra,
    });
  }

  const titles = (rows: { project: string }[]) => rows.map((r) => r.project).sort();

  describe('createProject', () => {
    it('stores category, epic and personal goal, and fills in the defaults', async () => {
      const epic = await epicService.createEpic(db, TIM, { title: 'Acme Solar', category: 'Solfit' });
      const created = await newTask(TIM, 1, 'solfit', {
        project: 'Install solar panel inverters',
        reason: 'Site trial Monday',
        epicId: epic!.id,
        goalId: 'g-tim',
        customer: 'Acme Solar',
        tags: 'roof,inverter',
      });

      expect(created).toMatchObject({
        id: uuid(1),
        project: 'Install solar panel inverters',
        reason: 'Site trial Monday',
        category: 'Solfit',
        projectId: 'proj-solfit',
        projectKey: 'SOL',
        orgName: 'Migrating Dragons',
        epicId: epic!.id,
        goalId: 'g-tim',
        customer: 'Acme Solar',
        tags: 'roof,inverter',
        status: 'do',
        priority: 5,
        size: '***',
        isDeleted: false,
        userId: TIM,
        reporterId: TIM,
        reporterName: 'Tim Dobson',
        assigneeId: TIM,
        updatedById: TIM,
        isMine: true,
        canEdit: true,
      });
      expect(created.statusLastChangedOn).toBeTruthy();
      expect(created.createdAt).toBeTruthy();

      const [entry] = await getActivity(db, TIM, { taskId: uuid(1) });
      expect(entry).toMatchObject({ action: 'created', epicId: epic!.id });
    });

    it('puts a task with no category into a "General" project in the personal workspace', async () => {
      const created = await projectService.createProject(db, ROBIN, {
        id: uuid(1),
        project: 'Loose end',
        status: 'do',
        priority: 3,
        size: '*',
      });
      expect(created).toMatchObject({ category: 'General', orgName: 'Robin Fairweather' });
    });

    it('takes an explicit projectId over the category', async () => {
      const created = await newTask(TIM, 1, 'Personal', { projectId: 'proj-md' });
      expect(created.projectId).toBe('proj-md');
      await expect(newTask(TIM, 2, 'x', { projectId: 'proj-stranger' })).rejects.toMatchObject({
        status: 404,
      });
    });

    it('supports unassigned tasks and assigning to another workspace member', async () => {
      const unassigned = await newTask(TIM, 1, 'Solfit', { assigneeId: null });
      expect(unassigned).toMatchObject({ assigneeId: null, assigneeName: null, isMine: true });

      const forRobin = await newTask(TIM, 2, 'Solfit', { assigneeId: ROBIN });
      expect(forRobin).toMatchObject({ assigneeName: 'Robin Fairweather', isMine: false });

      await expect(newTask(TIM, 3, 'Personal', { assigneeId: ROBIN })).rejects.toThrow(/isn't in/);
    });

    it('rejects epics and goals the user cannot use', async () => {
      const strangerEpic = await epicService.createEpic(db, STRANGER, {
        title: 'Secret',
        category: 'Stranger Things',
      });
      await expect(newTask(TIM, 1, 'Solfit', { epicId: strangerEpic!.id })).rejects.toMatchObject({
        status: 404,
      });
      await expect(newTask(TIM, 2, 'Solfit', { epicId: 'missing' })).rejects.toBeInstanceOf(
        AccessError
      );
      await expect(newTask(TIM, 3, 'Solfit', { goalId: 'g-robin' })).rejects.toThrow(/goal/i);
    });
  });

  describe('getProjectsForUser filters', () => {
    beforeEach(async () => {
      const epic = await epicService.createEpic(db, TIM, {
        id: 'epic-1',
        title: 'Epic',
        category: 'Solfit',
      });
      expect(epic?.id).toBe('epic-1');
      await newTask(TIM, 1, 'Solfit', {
        epicId: 'epic-1',
        goalId: 'g-tim',
        customer: 'Acme Solar',
        tags: 'roof,urgent',
      });
      await newTask(TIM, 2, 'Solfit', { customer: 'Eco2Solar', tags: 'office' });
      await newTask(TIM, 3, 'Migrating Dragons', { goalId: 'g-tim-2', assigneeId: null });
      await newTask(TIM, 4, 'Personal', { epicId: undefined, tags: 'URGENT' });
      await newTask(ROBIN, 5, 'Migrating Dragons');
      await newTask(TIM, 6, 'Solfit', { epicId: 'epic-1' });
      await projectService.deleteProject(db, TIM, uuid(6));
    });

    it('returns every visible, non-deleted task by default', async () => {
      expect(titles(await projectService.getProjectsForUser(db, TIM))).toEqual([
        'Task 1',
        'Task 2',
        'Task 3',
        'Task 4',
        'Task 5',
      ]);
    });

    it('filters by category (case-insensitive), epic and personal goal', async () => {
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { category: ' solfit ' }))
      ).toEqual(['Task 1', 'Task 2']);
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { epicId: 'epic-1' }))
      ).toEqual(['Task 1']);
      expect(titles(await projectService.getProjectsForUser(db, TIM, { goalId: 'g-tim' }))).toEqual(
        ['Task 1']
      );
      expect(
        titles(
          await projectService.getProjectsForUser(db, TIM, {
            category: 'Solfit',
            epicId: 'epic-1',
            goalId: 'g-tim',
          })
        )
      ).toEqual(['Task 1']);
      // Goal links are personal: Robin has no link to Tim's goal
      expect(await projectService.getProjectsForUser(db, ROBIN, { goalId: 'g-tim' })).toEqual([]);
      expect(await projectService.getProjectsForUser(db, TIM, { category: 'Nope' })).toEqual([]);
    });

    it('filters by customer and tag case-insensitively', async () => {
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { customer: 'acme solar' }))
      ).toEqual(['Task 1']);
      expect(titles(await projectService.getProjectsForUser(db, TIM, { tag: 'urgent' }))).toEqual([
        'Task 1',
        'Task 4',
      ]);
    });

    it('filters by workspace and project id', async () => {
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { orgId: 'org-tim' }))
      ).toEqual(['Task 4']);
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { projectId: 'proj-md' }))
      ).toEqual(['Task 3', 'Task 5']);
      expect(
        await projectService.getProjectsForUser(db, TIM, { projectId: 'proj-stranger' })
      ).toEqual([]);
    });

    it('filters by assignee', async () => {
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { assignee: 'mine_or_unassigned' }))
      ).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { assignee: ROBIN }))
      ).toEqual(['Task 5']);
      expect(titles(await projectService.getProjectsForUser(db, TIM, { assignee: 'me' }))).toEqual([
        'Task 1',
        'Task 2',
        'Task 3',
        'Task 4',
      ]);
    });

    it('filters by related task, in both directions', async () => {
      raw.exec(`
        INSERT INTO TaskRelations (id, source_task_id, target_task_id, relation_type) VALUES
          ('r1', '${uuid(1)}', '${uuid(2)}', 'blocks'),
          ('r2', '${uuid(3)}', '${uuid(1)}', 'relates_to');
      `);
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { relatedTo: uuid(1) }))
      ).toEqual(['Task 2', 'Task 3']);
      expect(
        titles(await projectService.getProjectsForUser(db, TIM, { relatedTo: uuid(2) }))
      ).toEqual(['Task 1']);
      expect(await projectService.getProjectsForUser(db, TIM, { relatedTo: 'zzz' })).toEqual([]);
    });
  });

  describe('updateProject', () => {
    it('stamps status changes and clears the return date when leaving awaiting', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-01T09:00:00.000Z'));
      await newTask(TIM, 1, 'Solfit', { status: 'awaiting', awaitUntil: '2026-12-01' });

      vi.setSystemTime(new Date('2026-10-02T09:00:00.000Z'));
      const updated = await projectService.updateProject(db, ROBIN, uuid(1), { status: 'do' });
      expect(updated).toMatchObject({
        status: 'do',
        awaitUntil: null,
        statusLastChangedOn: '2026-10-02T09:00:00.000Z',
        updatedAt: '2026-10-02T09:00:00.000Z',
        updatedByName: 'Robin Fairweather',
      });

      vi.setSystemTime(new Date('2026-10-03T09:00:00.000Z'));
      const reprioritised = await projectService.updateProject(db, TIM, uuid(1), { priority: 9 });
      expect(reprioritised?.statusLastChangedOn).toBe('2026-10-02T09:00:00.000Z');
      expect(reprioritised?.priority).toBe(9);

      const summaries = (await getActivity(db, TIM, { taskId: uuid(1) })).map((a) => a.summary);
      expect(summaries).toEqual([
        'Updated priority on "Task 1"',
        'Moved "Task 1" from Awaiting to Do',
        'Created "Task 1"',
      ]);
    });

    it('moves a task to another project by category name', async () => {
      await newTask(TIM, 1, 'Solfit');
      const moved = await projectService.updateProject(db, TIM, uuid(1), { category: 'Personal' });
      expect(moved).toMatchObject({ projectId: 'proj-personal', category: 'Personal' });
      expect(await projectService.getTaskView(db, ROBIN, uuid(1))).toBeNull();
    });

    it('soft-deletes and restores', async () => {
      await newTask(TIM, 1, 'Solfit');
      expect(await projectService.deleteProject(db, TIM, uuid(1))).toBe(true);
      expect(await projectService.getProjectsForUser(db, TIM)).toEqual([]);
      expect(await projectService.getTaskView(db, TIM, uuid(1))).toBeNull();
      expect(
        (await projectService.getTaskView(db, TIM, uuid(1), { includeDeleted: true }))?.isDeleted
      ).toBe(true);
      // Deleted tasks can't be edited again through the normal path
      expect(await projectService.updateProject(db, TIM, uuid(1), { isDeleted: false })).toBeNull();
      expect(await projectService.deleteProject(db, STRANGER, uuid(1))).toBe(false);

      const actions = (await getActivity(db, TIM, { taskId: uuid(1) })).map((a) => a.summary);
      expect(actions.sort()).toEqual(['Created "Task 1"', 'Deleted "Task 1"']);
    });

    it('refuses deleteProject for viewers with a 403', async () => {
      await newTask(TIM, 1, 'Solfit');
      await orgService.updateMemberRole(db, TIM, 'org-md', ROBIN, 'viewer');
      await expect(projectService.deleteProject(db, ROBIN, uuid(1))).rejects.toMatchObject({
        status: 403,
      });
      expect(await projectService.getTaskView(db, TIM, uuid(1))).not.toBeNull();
    });
  });

  describe('batchUpdateProjects', () => {
    it('updates priority and status, skipping rows the caller cannot edit', async () => {
      await newTask(TIM, 1, 'Solfit');
      await newTask(TIM, 2, 'Personal');
      await newTask(STRANGER, 3, 'Stranger Things');

      await projectService.batchUpdateProjects(db, ROBIN, [
        { id: uuid(1), priority: 8, status: 'done' },
        { id: uuid(2), priority: 8, status: 'done' },
        { id: uuid(3), priority: 8, status: 'done' },
      ]);

      expect(await projectService.getTaskView(db, TIM, uuid(1))).toMatchObject({
        priority: 8,
        status: 'done',
        updatedById: ROBIN,
      });
      expect(await projectService.getTaskView(db, TIM, uuid(2))).toMatchObject({
        priority: 5,
        status: 'do',
      });
      expect(await projectService.getTaskView(db, STRANGER, uuid(3))).toMatchObject({
        priority: 5,
        status: 'do',
      });
      const entry = (await getActivity(db, TIM, { taskId: uuid(1) })).find(
        (a) => a.action === 'completed'
      );
      expect(entry).toMatchObject({
        actorName: 'Robin Fairweather',
        summary: 'Moved "Task 1" from Do to Done',
      });
      expect(await getActivity(db, TIM, { taskId: uuid(2) })).toHaveLength(1);
    });
  });

  describe('notes', () => {
    it('adds notes with authors, lists them oldest first and controls deletion', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-01T09:00:00.000Z'));
      await newTask(TIM, 1, 'Solfit');
      const first = await projectService.addProjectUpdate(db, {
        projectId: uuid(1),
        userId: TIM,
        note: 'Called the roofer',
        gmailThreadId: 'thread-1',
      });
      expect(first).toMatchObject({
        projectId: uuid(1),
        userId: TIM,
        authorName: 'Tim Dobson',
        note: 'Called the roofer',
        gmailThreadId: 'thread-1',
        canDelete: true,
      });

      vi.setSystemTime(new Date('2026-10-02T09:00:00.000Z'));
      await projectService.addProjectUpdate(db, {
        projectId: uuid(1),
        userId: ROBIN,
        note: 'Roofer booked',
      });

      const asRobin = await projectService.getProjectUpdates(db, uuid(1), ROBIN);
      expect(asRobin?.map((n) => [n.authorName, n.note, n.canDelete])).toEqual([
        ['Tim Dobson', 'Called the roofer', false],
        ['Robin Fairweather', 'Roofer booked', true],
      ]);
      const asTim = await projectService.getProjectUpdates(db, uuid(1), TIM);
      expect(asTim?.every((n) => n.canDelete)).toBe(true);

      // Adding a note touches the task's attribution
      expect((await projectService.getTaskView(db, TIM, uuid(1)))?.updatedByName).toBe(
        'Robin Fairweather'
      );

      // Owner can delete anyone's note
      const robinsNote = asTim!.find((n) => n.userId === ROBIN)!;
      expect(
        await projectService.deleteProjectUpdate(db, {
          updateId: robinsNote.id,
          projectId: uuid(1),
          userId: TIM,
        })
      ).toBe(true);
      expect(
        await projectService.deleteProjectUpdate(db, {
          updateId: 'missing',
          projectId: uuid(1),
          userId: TIM,
        })
      ).toBe(false);
      expect((await projectService.getProjectUpdates(db, uuid(1), TIM))?.length).toBe(1);
    });

    it('returns null when adding a note to a task the user cannot see', async () => {
      await newTask(TIM, 1, 'Solfit');
      expect(
        await projectService.addProjectUpdate(db, {
          projectId: uuid(1),
          userId: STRANGER,
          note: 'x',
        })
      ).toBeNull();
      expect(
        await projectService.addProjectUpdate(db, { projectId: 'missing', userId: TIM, note: 'x' })
      ).toBeNull();
    });
  });

  describe('mergeProjects', () => {
    it('returns null if targetId equals sourceId', async () => {
      expect(await projectService.mergeProjects(db, TIM, uuid(1), uuid(1))).toBeNull();
    });

    it('returns null if target or source does not exist or is not editable', async () => {
      await newTask(TIM, 1, 'Solfit');
      await newTask(STRANGER, 2, 'Stranger Things');
      expect(await projectService.mergeProjects(db, TIM, uuid(1), 'missing')).toBeNull();
      expect(await projectService.mergeProjects(db, TIM, 'missing', uuid(1))).toBeNull();
      expect(await projectService.mergeProjects(db, TIM, uuid(1), uuid(2))).toBeNull();

      await orgService.updateMemberRole(db, TIM, 'org-md', ROBIN, 'viewer');
      await newTask(TIM, 3, 'Solfit');
      expect(await projectService.mergeProjects(db, ROBIN, uuid(1), uuid(3))).toBeNull();
      expect(await projectService.getTaskView(db, TIM, uuid(3))).not.toBeNull();
    });

    it('merges source into target, re-parents notes and soft-deletes the source', async () => {
      const epic = await epicService.createEpic(db, TIM, { title: 'Auth', category: 'Solfit' });
      await newTask(TIM, 1, 'Solfit', {
        project: 'Fix login authentication',
        priority: 6,
        size: '**',
        notes: 'Initial target note',
        reason: 'Auth is broken',
      });
      await newTask(TIM, 2, 'Solfit', {
        project: 'Safari auth redirect bug',
        priority: 9,
        size: '****',
        status: 'delay',
        notes: 'Safari specific details',
        reason: 'Safari cookie policy',
        epicId: epic!.id,
        goalId: 'g-tim',
        gmailThreadId: 'thread-789',
      });
      await projectService.addProjectUpdate(db, {
        projectId: uuid(2),
        userId: ROBIN,
        note: 'Found bug in webkit cookies',
      });

      const merged = await projectService.mergeProjects(db, TIM, uuid(1), uuid(2));

      expect(merged).toMatchObject({
        id: uuid(1),
        project: 'Fix login authentication',
        priority: 9,
        size: '****',
        status: 'do',
        category: 'Solfit',
        epicId: epic!.id,
        goalId: 'g-tim',
        gmailThreadId: 'thread-789',
        reason: 'Auth is broken (Also: Safari cookie policy)',
      });
      expect(merged!.notes).toBe(
        `Initial target note\n\n---\nMerged from "Safari auth redirect bug" (${uuid(2).slice(0, 8)}):\nSafari specific details`
      );

      const notes = await projectService.getProjectUpdates(db, uuid(1), TIM);
      expect(notes?.map((n) => n.note)).toEqual(
        expect.arrayContaining([
          'Found bug in webkit cookies',
          `Merged task 'Safari auth redirect bug' (${uuid(2).slice(0, 8)}) into this task.`,
        ])
      );
      expect(notes?.find((n) => n.note === 'Found bug in webkit cookies')?.authorName).toBe(
        'Robin Fairweather'
      );

      const source = await projectService.getTaskView(db, TIM, uuid(2), { includeDeleted: true });
      expect(source?.isDeleted).toBe(true);
      expect(source?.notes).toContain(
        'Safari specific details\n\n[Merged into "Fix login authentication" (00000000) on'
      );
      expect(await projectService.getProjectUpdates(db, uuid(2), TIM)).toBeNull();

      const entry = (await getActivity(db, ROBIN, { taskId: uuid(1) })).find(
        (a) => a.action === 'merged'
      );
      expect(entry).toMatchObject({
        actorName: 'Tim Dobson',
        summary: 'Merged "Safari auth redirect bug" into "Fix login authentication"',
      });
    });

    it("keeps the target's own fields when the source has less", async () => {
      await newTask(TIM, 1, 'Solfit', {
        priority: 8,
        size: '*****',
        reason: 'Keep me',
        goalId: 'g-tim',
      });
      await newTask(TIM, 2, 'Solfit', { priority: 2, size: '*', goalId: 'g-tim-2' });
      const merged = await projectService.mergeProjects(db, TIM, uuid(1), uuid(2));
      expect(merged).toMatchObject({
        priority: 8,
        size: '*****',
        reason: 'Keep me',
        notes: null,
        goalId: 'g-tim',
      });
      const source = await projectService.getTaskView(db, TIM, uuid(2), { includeDeleted: true });
      expect(source?.notes).toMatch(/^\[Merged into "Task 1" \(00000000\) on \d{4}-\d{2}-\d{2}\]$/);
    });
  });

  describe('processAwaitingReturns', () => {
    it('only brings back awaiting tasks whose date has passed', async () => {
      await newTask(TIM, 1, 'Solfit', { status: 'awaiting', awaitUntil: '2020-01-01' });
      await newTask(TIM, 2, 'Solfit', { status: 'awaiting', awaitUntil: '2999-01-01' });
      await newTask(TIM, 3, 'Solfit', { status: 'awaiting', awaitUntil: '2020-01-01' });
      await projectService.deleteProject(db, TIM, uuid(3));

      expect(await projectService.processAwaitingReturns(db)).toEqual({ flipped: 1, total: 1 });
      expect(await projectService.getTaskView(db, TIM, uuid(1))).toMatchObject({
        status: 'do',
        awaitUntil: null,
      });
      expect((await projectService.getTaskView(db, TIM, uuid(2)))?.status).toBe('awaiting');
    });
  });
});
