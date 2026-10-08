/**
 * The `/projects` API: TimDo's original task-shaped contract ("project" = task title,
 * "category" = project name), now backed by the multi-user Tasks / Projects / Organisations
 * tables. Every read is scoped to the workspaces the caller belongs to, every write is
 * permission-checked and recorded in the activity log.
 */
import { and, asc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '../db/schema';
import type {
  ProjectCreatePayload,
  ProjectUpdateBatchPayload,
  ProjectUpdatePayload,
} from '../validators/projectValidators';
import {
  AccessError,
  canEdit,
  canManage,
  getAccessibleProjects,
  getUserNames,
  resolveProjectForWrite,
  type AccessibleProject,
  type Role,
} from './accessService';
import {
  describeFieldEdits,
  diffFields,
  logActivity,
  statusLabel,
  type FieldChanges,
} from './activityService';
import { resolveTaskIdForUser } from './taskService';

type DB = DrizzleD1Database<typeof schema>;
type TaskRow = typeof schema.tasks.$inferSelect;

export interface ProjectFilters {
  category?: string;
  epicId?: string;
  goalId?: string;
  customer?: string;
  tag?: string;
  relatedTo?: string;
  /** 'me' | 'unassigned' | 'mine_or_unassigned' | <userId> */
  assignee?: string;
  orgId?: string;
  projectId?: string;
}

/** A task in the original `/projects` shape, plus who-did-what and sharing context. */
export interface TaskView {
  id: string;
  userId: string;
  project: string;
  reason: string | null;
  status: TaskRow['status'];
  priority: number;
  size: TaskRow['size'];
  notes: string | null;
  statusLastChangedOn: string | null;
  awaitUntil: string | null;
  gmailThreadId: string | null;
  category: string;
  customer: string | null;
  tags: string | null;
  epicId: string | null;
  goalId: string | null;
  isDeleted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  projectId: string;
  projectKey: string;
  projectName: string;
  orgId: string;
  orgName: string;
  isShared: boolean;
  myRole: Role;
  canEdit: boolean;
  reporterId: string;
  reporterName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  updatedById: string | null;
  updatedByName: string | null;
  isMine: boolean;
}

function toView(
  task: TaskRow,
  project: AccessibleProject,
  userId: string,
  names: Map<string, string>,
  goalId: string | null
): TaskView {
  return {
    id: task.id,
    userId: task.reporterId,
    project: task.title,
    reason: task.reason,
    status: task.status,
    priority: task.priority,
    size: task.size,
    notes: task.notes,
    statusLastChangedOn: task.statusLastChangedOn,
    awaitUntil: task.awaitUntil,
    gmailThreadId: task.gmailThreadId,
    category: project.name,
    customer: task.customer,
    tags: task.tags,
    epicId: task.epicId,
    goalId,
    isDeleted: !!task.isDeleted,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    projectId: project.id,
    projectKey: project.key,
    projectName: project.name,
    orgId: project.orgId,
    orgName: project.orgName,
    isShared: project.memberCount > 1,
    myRole: project.role,
    canEdit: canEdit(project.role),
    reporterId: task.reporterId,
    reporterName: names.get(task.reporterId) ?? null,
    assigneeId: task.assigneeId,
    assigneeName: task.assigneeId ? (names.get(task.assigneeId) ?? null) : null,
    // Rows synced from the legacy single-user table have no updated_by: the reporter made them
    updatedById: task.updatedBy ?? task.reporterId,
    updatedByName: names.get(task.updatedBy ?? task.reporterId) ?? null,
    isMine: task.assigneeId === userId || (!task.assigneeId && task.reporterId === userId),
  };
}

async function personalGoalMap(db: DB, userId: string) {
  const links = await db
    .select({ taskId: schema.taskUserGoals.taskId, goalId: schema.taskUserGoals.goalId })
    .from(schema.taskUserGoals)
    .where(eq(schema.taskUserGoals.userId, userId));
  const map = new Map<string, string>();
  for (const l of links) {
    if (!map.has(l.taskId)) {
      map.set(l.taskId, l.goalId);
    }
  }
  return map;
}

async function buildViews(db: DB, userId: string, rows: TaskRow[], projects: AccessibleProject[]) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const [names, goals] = await Promise.all([
    getUserNames(
      db,
      rows.flatMap((t) => [t.reporterId, t.assigneeId, t.updatedBy])
    ),
    personalGoalMap(db, userId),
  ]);
  return rows
    .filter((t) => byId.has(t.projectId))
    .map((t) => toView(t, byId.get(t.projectId)!, userId, names, goals.get(t.id) ?? null));
}

export async function getProjectsForUser(
  db: DB,
  userId: string,
  filters: ProjectFilters = {}
): Promise<TaskView[]> {
  let projects = await getAccessibleProjects(db, userId);
  if (filters.orgId) {
    projects = projects.filter((p) => p.orgId === filters.orgId);
  }
  if (filters.projectId) {
    projects = projects.filter((p) => p.id === filters.projectId);
  }
  if (filters.category) {
    const c = filters.category.trim().toLowerCase();
    projects = projects.filter((p) => p.name.toLowerCase() === c);
  }
  if (projects.length === 0) {
    return [];
  }

  const conditions = [
    inArray(
      schema.tasks.projectId,
      projects.map((p) => p.id)
    ),
    eq(schema.tasks.isDeleted, false),
  ];

  if (filters.epicId) {
    conditions.push(eq(schema.tasks.epicId, filters.epicId));
  }
  if (filters.goalId) {
    conditions.push(
      sql`${schema.tasks.id} in (select task_id from TaskUserGoals where user_id = ${userId} and goal_id = ${filters.goalId})`
    );
  }
  if (filters.customer) {
    conditions.push(sql`lower(${schema.tasks.customer}) = lower(${filters.customer.trim()})`);
  }
  if (filters.tag) {
    const cleanTag = filters.tag.trim().toLowerCase();
    conditions.push(sql`lower(coalesce(${schema.tasks.tags}, '')) LIKE lower(${`%${cleanTag}%`})`);
  }
  if (filters.assignee) {
    const a = filters.assignee;
    if (a === 'me') {
      conditions.push(
        sql`(${schema.tasks.assigneeId} = ${userId} or (${schema.tasks.assigneeId} is null and ${schema.tasks.reporterId} = ${userId}))`
      );
    } else if (a === 'unassigned') {
      conditions.push(sql`${schema.tasks.assigneeId} is null`);
    } else if (a === 'mine_or_unassigned') {
      conditions.push(
        sql`(${schema.tasks.assigneeId} = ${userId} or ${schema.tasks.assigneeId} is null)`
      );
    } else {
      conditions.push(eq(schema.tasks.assigneeId, a));
    }
  }
  if (filters.relatedTo) {
    const target = await resolveTaskIdForUser(db, userId, filters.relatedTo);
    if (!target) {
      return [];
    }
    conditions.push(
      sql`${schema.tasks.id} in (
        select target_task_id from TaskRelations where source_task_id = ${target}
        union select source_task_id from TaskRelations where target_task_id = ${target})`
    );
  }

  const rows = await db
    .select()
    .from(schema.tasks)
    .where(and(...conditions));
  return buildViews(db, userId, rows, projects);
}

/** One task, if the user can see it. */
export async function getTaskView(
  db: DB,
  userId: string,
  taskId: string,
  { includeDeleted = false } = {}
): Promise<TaskView | null> {
  const task = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).get();
  if (!task || (task.isDeleted && !includeDeleted)) {
    return null;
  }
  const projects = await getAccessibleProjects(db, userId);
  const views = await buildViews(db, userId, [task], projects);
  return views[0] ?? null;
}

/** Load a task the user is allowed to change, or throw. */
async function loadEditable(db: DB, userId: string, taskId: string) {
  const task = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.isDeleted, false)))
    .get();
  if (!task) {
    return null;
  }
  const projects = await getAccessibleProjects(db, userId);
  const project = projects.find((p) => p.id === task.projectId);
  if (!project) {
    return null;
  }
  if (!canEdit(project.role)) {
    throw new AccessError(`You have view-only access to "${project.name}"`);
  }
  return { task, project, projects };
}

async function assertAssignable(
  db: DB,
  assigneeId: string,
  project: AccessibleProject
): Promise<void> {
  const member = await db
    .select({ role: schema.organisationMembers.role })
    .from(schema.organisationMembers)
    .where(
      and(
        eq(schema.organisationMembers.orgId, project.orgId),
        eq(schema.organisationMembers.userId, assigneeId)
      )
    )
    .get();
  if (!member) {
    throw new AccessError(`That person isn't in the "${project.orgName}" workspace`);
  }
}

/** A task can only join an epic in the same workspace (or a private epic of yours in your own). */
async function assertEpicUsable(
  db: DB,
  userId: string,
  epicId: string,
  taskProject: AccessibleProject
) {
  const epic = await db.select().from(schema.epics).where(eq(schema.epics.id, epicId)).get();
  if (!epic) {
    throw new AccessError('Epic not found', 404);
  }
  if (epic.projectId) {
    const projects = await getAccessibleProjects(db, userId);
    const epicProject = projects.find((p) => p.id === epic.projectId);
    if (!epicProject) {
      throw new AccessError('Epic not found', 404);
    }
    if (epicProject.orgId !== taskProject.orgId) {
      throw new AccessError(
        `That epic is in ${epicProject.orgName}, but this task is in ${taskProject.orgName}`
      );
    }
  } else if (epic.userId !== userId || !taskProject.orgIsPersonal) {
    throw new AccessError('Epic not found', 404);
  }
}

/** Taking work out of a shared workspace is an owner/admin decision. */
function assertCanMoveBetween(from: AccessibleProject, to: AccessibleProject) {
  if (from.orgId !== to.orgId && !canManage(from.role)) {
    throw new AccessError(
      `Only owners and admins can move things out of ${from.orgName}. Pick a project in the same workspace.`
    );
  }
}

async function isOrgMember(db: DB, userId: string, orgId: string) {
  const row = await db
    .select({ id: schema.organisationMembers.id })
    .from(schema.organisationMembers)
    .where(
      and(
        eq(schema.organisationMembers.orgId, orgId),
        eq(schema.organisationMembers.userId, userId)
      )
    )
    .get();
  return !!row;
}

async function setPersonalGoal(db: DB, userId: string, taskId: string, goalId: string | null) {
  await db
    .delete(schema.taskUserGoals)
    .where(and(eq(schema.taskUserGoals.taskId, taskId), eq(schema.taskUserGoals.userId, userId)));
  if (!goalId) {
    return;
  }
  const goal = await db
    .select({ id: schema.goals.id })
    .from(schema.goals)
    .where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, userId)))
    .get();
  if (!goal) {
    throw new AccessError('Life goal not found', 404);
  }
  await db.insert(schema.taskUserGoals).values({ taskId, userId, goalId });
}

export async function createProject(
  db: DB,
  userId: string,
  data: ProjectCreatePayload & { id: string }
): Promise<TaskView> {
  let project: AccessibleProject;
  if (data.projectId) {
    const found = (await getAccessibleProjects(db, userId)).find((p) => p.id === data.projectId);
    if (!found) {
      throw new AccessError('Project not found', 404);
    }
    if (!canEdit(found.role)) {
      throw new AccessError(`You have view-only access to "${found.name}"`);
    }
    project = found;
  } else {
    project = await resolveProjectForWrite(db, userId, data.category);
  }

  const assigneeId = data.assigneeId === undefined ? userId : data.assigneeId;
  if (assigneeId && assigneeId !== userId) {
    await assertAssignable(db, assigneeId, project);
  }
  if (data.epicId) {
    await assertEpicUsable(db, userId, data.epicId, project);
  }

  const now = new Date().toISOString();
  await db.insert(schema.tasks).values({
    id: data.id,
    projectId: project.id,
    epicId: data.epicId ?? null,
    reporterId: userId,
    assigneeId,
    title: data.project,
    reason: data.reason ?? null,
    status: data.status,
    priority: data.priority,
    size: data.size,
    notes: data.notes ?? null,
    statusLastChangedOn: now,
    awaitUntil: data.awaitUntil ?? null,
    gmailThreadId: data.gmailThreadId ?? null,
    customer: data.customer ?? null,
    tags: data.tags ?? null,
    isDeleted: false,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  });
  if (data.goalId) {
    await setPersonalGoal(db, userId, data.id, data.goalId);
  }

  await logActivity(db, {
    actorId: userId,
    orgId: project.orgId,
    projectId: project.id,
    entityType: 'task',
    entityId: data.id,
    taskId: data.id,
    epicId: data.epicId ?? null,
    action: 'created',
    summary: `Created "${data.project}"`,
  });

  return (await getTaskView(db, userId, data.id))!;
}

const TRACKED_FIELDS = [
  'title',
  'reason',
  'status',
  'priority',
  'size',
  'notes',
  'awaitUntil',
  'gmailThreadId',
  'customer',
  'tags',
  'epicId',
  'assigneeId',
  'projectId',
  'isDeleted',
];

export async function updateProject(
  db: DB,
  userId: string,
  taskId: string,
  data: ProjectUpdatePayload
): Promise<TaskView | null> {
  const loaded = await loadEditable(db, userId, taskId);
  if (!loaded) {
    return null;
  }
  const { task, project, projects } = loaded;

  const patch: Partial<typeof schema.tasks.$inferInsert> = {};
  if (data.project !== undefined) {
    patch.title = data.project;
  }
  for (const key of [
    'reason',
    'status',
    'priority',
    'size',
    'notes',
    'awaitUntil',
    'gmailThreadId',
    'customer',
    'tags',
    'isDeleted',
  ] as const) {
    if (data[key] !== undefined) {
      (patch as any)[key] = data[key];
    }
  }

  // Moving between projects: by id, or by category name (the original API)
  let targetProject = project;
  if (data.projectId && data.projectId !== task.projectId) {
    const found = projects.find((p) => p.id === data.projectId);
    if (!found) {
      throw new AccessError('Project not found', 404);
    }
    if (!canEdit(found.role)) {
      throw new AccessError(`You have view-only access to "${found.name}"`);
    }
    targetProject = found;
  } else if (
    data.category !== undefined &&
    (data.category || 'General').trim().toLowerCase() !== project.name.toLowerCase()
  ) {
    targetProject = await resolveProjectForWrite(db, userId, data.category);
  }
  if (targetProject.id !== task.projectId) {
    assertCanMoveBetween(project, targetProject);
    patch.projectId = targetProject.id;
  }

  if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
    if (data.assigneeId) {
      await assertAssignable(db, data.assigneeId, targetProject);
    }
    patch.assigneeId = data.assigneeId;
  }
  if (data.epicId !== undefined && data.epicId !== task.epicId) {
    if (data.epicId) {
      await assertEpicUsable(db, userId, data.epicId, targetProject);
    }
    patch.epicId = data.epicId;
  }

  // Moving to another workspace: the assignee must be in it, and the epic must come along
  if (patch.projectId && targetProject.orgId !== project.orgId) {
    const assignee = patch.assigneeId !== undefined ? patch.assigneeId : task.assigneeId;
    if (assignee && !(await isOrgMember(db, assignee, targetProject.orgId))) {
      patch.assigneeId = null;
    }
    const epicId = patch.epicId !== undefined ? patch.epicId : task.epicId;
    if (epicId && data.epicId === undefined) {
      patch.epicId = null;
    }
  }

  const changes = diffFields(task as any, patch as any, TRACKED_FIELDS);

  // Life goals are private to each person, so goal links never reach the shared activity log
  if (data.goalId !== undefined) {
    const current = (await personalGoalMap(db, userId)).get(taskId) ?? null;
    if ((data.goalId ?? null) !== current) {
      await setPersonalGoal(db, userId, taskId, data.goalId ?? null);
    }
  }

  if (Object.keys(changes).length > 0) {
    const now = new Date().toISOString();
    const set: Partial<typeof schema.tasks.$inferInsert> = {
      ...patch,
      updatedAt: now,
      updatedBy: userId,
    };
    if (changes.status) {
      set.statusLastChangedOn = now;
    }
    if (changes.status && patch.status !== 'awaiting' && data.awaitUntil === undefined) {
      set.awaitUntil = null;
    }
    await db.update(schema.tasks).set(set).where(eq(schema.tasks.id, taskId));
    await logTaskChanges(db, userId, task, targetProject, changes);
  }

  return getTaskView(db, userId, taskId, { includeDeleted: true });
}

async function logTaskChanges(
  db: DB,
  userId: string,
  task: TaskRow,
  project: AccessibleProject,
  changes: FieldChanges
) {
  const base = {
    actorId: userId,
    orgId: project.orgId,
    projectId: project.id,
    entityType: 'task' as const,
    entityId: task.id,
    taskId: task.id,
    epicId: (changes.epicId?.to as string | null) ?? task.epicId,
  };
  const title = (changes.title?.to as string) ?? task.title;

  if (changes.isDeleted) {
    await logActivity(db, {
      ...base,
      action: changes.isDeleted.to ? 'deleted' : 'restored',
      summary: changes.isDeleted.to ? `Deleted "${title}"` : `Restored "${title}"`,
    });
    return;
  }

  const rest: FieldChanges = { ...changes };
  if (changes.status) {
    delete rest.status;
    const awaiting =
      changes.status.to === 'awaiting' && (changes.awaitUntil?.to || task.awaitUntil)
        ? ` until ${changes.awaitUntil?.to ?? task.awaitUntil}`
        : '';
    delete rest.awaitUntil;
    await logActivity(db, {
      ...base,
      action: changes.status.to === 'done' ? 'completed' : 'status_changed',
      summary: `Moved "${title}" from ${statusLabel(changes.status.from)} to ${statusLabel(changes.status.to)}${awaiting}`,
      changes: { status: changes.status },
    });
  }
  if (changes.assigneeId) {
    delete rest.assigneeId;
    const names = await getUserNames(db, [changes.assigneeId.to as string]);
    const to = changes.assigneeId.to
      ? (names.get(changes.assigneeId.to as string) ?? 'someone')
      : null;
    await logActivity(db, {
      ...base,
      action: 'assigned',
      summary: to ? `Assigned "${title}" to ${to}` : `Unassigned "${title}"`,
      changes: { assigneeId: changes.assigneeId },
    });
  }
  if (changes.projectId) {
    delete rest.projectId;
    await logActivity(db, {
      ...base,
      action: 'moved',
      summary: `Moved "${title}" to ${project.name}`,
      changes: { projectId: changes.projectId },
    });
  }
  const summary = describeFieldEdits(rest);
  if (summary) {
    await logActivity(db, {
      ...base,
      action: 'updated',
      summary: `${summary} on "${title}"`,
      changes: rest,
    });
  }
}

/** Soft delete. Viewers get an AccessError (403) rather than a misleading 404. */
export async function deleteProject(db: DB, userId: string, taskId: string) {
  const result = await updateProject(db, userId, taskId, { isDeleted: true });
  return !!result;
}

export async function batchUpdateProjects(
  db: DB,
  userId: string,
  updates: ProjectUpdateBatchPayload
) {
  if (updates.length === 0) {
    return [];
  }
  const projects = await getAccessibleProjects(db, userId);
  const roleByProject = new Map(projects.map((p) => [p.id, p]));
  const now = new Date().toISOString();

  for (const update of updates) {
    const task = await db
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.id, update.id), eq(schema.tasks.isDeleted, false)))
      .get();
    const project = task ? roleByProject.get(task.projectId) : undefined;
    if (!task || !project || !canEdit(project.role)) {
      continue;
    }
    if (task.priority === update.priority && task.status === update.status) {
      continue;
    }

    const set: Partial<typeof schema.tasks.$inferInsert> = {
      priority: update.priority,
      status: update.status,
      updatedAt: now,
      updatedBy: userId,
    };
    if (task.status !== update.status) {
      set.statusLastChangedOn = now;
    }
    await db.update(schema.tasks).set(set).where(eq(schema.tasks.id, task.id));
    if (task.status !== update.status) {
      await logTaskChanges(db, userId, task, project, {
        status: { from: task.status, to: update.status },
      });
    }
  }
  return [];
}

/**
 * Finds all tasks whose awaiting date has passed and returns them to "do" status.
 * Each row is updated independently — one bad row won't block the batch.
 */
export async function processAwaitingReturns(db: DB) {
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const due = await db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      projectId: schema.tasks.projectId,
      orgId: schema.projects.orgId,
    })
    .from(schema.tasks)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
    .where(
      and(
        eq(schema.tasks.status, 'awaiting'),
        isNotNull(schema.tasks.awaitUntil),
        lte(schema.tasks.awaitUntil, now),
        eq(schema.tasks.isDeleted, false)
      )
    );

  let flipped = 0;
  for (const task of due) {
    try {
      const ts = new Date().toISOString();
      await db
        .update(schema.tasks)
        .set({ status: 'do', awaitUntil: null, statusLastChangedOn: ts, updatedAt: ts })
        .where(eq(schema.tasks.id, task.id));
      await logActivity(db, {
        actorId: null,
        orgId: task.orgId,
        projectId: task.projectId,
        entityType: 'task',
        entityId: task.id,
        taskId: task.id,
        action: 'status_changed',
        summary: `Brought "${task.title}" back to Do (return date reached)`,
        changes: { status: { from: 'awaiting', to: 'do' } },
      });
      flipped++;
    } catch (e) {
      console.error(`Failed to flip awaiting task ${task.id}:`, e);
    }
  }

  return { flipped, total: due.length };
}

export interface NoteView {
  id: string;
  projectId: string;
  userId: string;
  authorName: string | null;
  note: string;
  gmailThreadId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  canDelete: boolean;
}

export async function getProjectUpdates(
  db: DB,
  taskId: string,
  userId: string
): Promise<NoteView[] | null> {
  const view = await getTaskView(db, userId, taskId);
  if (!view) {
    return null;
  }
  const rows = await db
    .select()
    .from(schema.taskUpdates)
    .where(eq(schema.taskUpdates.taskId, taskId))
    .orderBy(asc(schema.taskUpdates.createdAt));
  const names = await getUserNames(
    db,
    rows.map((r) => r.authorId)
  );
  return rows.map((r) => ({
    id: r.id,
    projectId: r.taskId,
    userId: r.authorId,
    authorName: names.get(r.authorId) ?? null,
    note: r.note,
    gmailThreadId: r.gmailThreadId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    canDelete: r.authorId === userId || canManage(view.myRole),
  }));
}

export async function addProjectUpdate(
  db: DB,
  params: {
    id?: string;
    projectId: string;
    userId: string;
    note: string;
    gmailThreadId?: string | null;
  }
) {
  const loaded = await loadEditable(db, params.userId, params.projectId);
  if (!loaded) {
    return null;
  }
  const { task, project } = loaded;
  const now = new Date().toISOString();
  const row = {
    id: params.id ?? uuidv4(),
    taskId: task.id,
    authorId: params.userId,
    note: params.note,
    gmailThreadId: params.gmailThreadId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.taskUpdates).values(row);
  await db
    .update(schema.tasks)
    .set({ updatedAt: now, updatedBy: params.userId })
    .where(eq(schema.tasks.id, task.id));
  const preview = params.note.length > 140 ? `${params.note.slice(0, 137)}...` : params.note;
  await logActivity(db, {
    actorId: params.userId,
    orgId: project.orgId,
    projectId: project.id,
    entityType: 'note',
    entityId: row.id,
    taskId: task.id,
    epicId: task.epicId,
    action: 'note_added',
    summary: `Added a note to "${task.title}": ${preview}`,
  });
  const names = await getUserNames(db, [params.userId]);
  return {
    id: row.id,
    projectId: task.id,
    userId: params.userId,
    authorName: names.get(params.userId) ?? null,
    note: row.note,
    gmailThreadId: row.gmailThreadId,
    createdAt: now,
    updatedAt: now,
    canDelete: true,
  };
}

export async function deleteProjectUpdate(
  db: DB,
  params: { updateId: string; projectId: string; userId: string }
) {
  const view = await getTaskView(db, params.userId, params.projectId);
  if (!view) {
    return false;
  }
  const note = await db
    .select()
    .from(schema.taskUpdates)
    .where(
      and(
        eq(schema.taskUpdates.id, params.updateId),
        eq(schema.taskUpdates.taskId, params.projectId)
      )
    )
    .get();
  if (!note) {
    return false;
  }
  if (note.authorId !== params.userId && !canManage(view.myRole)) {
    return false;
  }
  await db.delete(schema.taskUpdates).where(eq(schema.taskUpdates.id, note.id));
  await logActivity(db, {
    actorId: params.userId,
    orgId: view.orgId,
    projectId: view.projectId,
    entityType: 'note',
    entityId: note.id,
    taskId: view.id,
    action: 'note_deleted',
    summary: `Deleted a note on "${view.project}"`,
  });
  return true;
}

const SIZE_ORDER: Record<string, number> = {
  '*': 1,
  '**': 2,
  '***': 3,
  '****': 4,
  '*****': 5,
};

function pickLargerSize(sizeA: string, sizeB: string): '*' | '**' | '***' | '****' | '*****' {
  const rankA = SIZE_ORDER[sizeA] || 3;
  const rankB = SIZE_ORDER[sizeB] || 3;
  return (rankB > rankA ? sizeB : sizeA) as '*' | '**' | '***' | '****' | '*****';
}

export async function mergeProjects(db: DB, userId: string, targetId: string, sourceId: string) {
  if (targetId === sourceId) {
    return null;
  }

  let target, source;
  try {
    target = await loadEditable(db, userId, targetId);
    source = await loadEditable(db, userId, sourceId);
  } catch (err) {
    if (err instanceof AccessError) {
      return null;
    }
    throw err;
  }
  if (!target || !source) {
    return null;
  }
  const t = target.task;
  const s = source.task;
  if (target.project.orgId !== source.project.orgId) {
    // Merging copies notes and history, which would expose them to another workspace
    throw new AccessError('Only tasks in the same workspace can be merged');
  }
  const now = new Date().toISOString();

  let combinedNotes = t.notes || '';
  if (s.notes && s.notes.trim()) {
    const mergeHeader = `

---
Merged from "${s.title}" (${s.id.slice(0, 8)}):
`;
    combinedNotes = combinedNotes ? combinedNotes + mergeHeader + s.notes : s.notes;
  }

  let combinedReason = t.reason || null;
  if (!combinedReason && s.reason) {
    combinedReason = s.reason;
  } else if (combinedReason && s.reason && s.reason !== combinedReason) {
    combinedReason = `${combinedReason} (Also: ${s.reason})`;
  }

  await db
    .update(schema.tasks)
    .set({
      priority: Math.max(t.priority, s.priority),
      size: pickLargerSize(t.size, s.size),
      notes: combinedNotes || null,
      reason: combinedReason,
      epicId: t.epicId ?? s.epicId ?? null,
      gmailThreadId: t.gmailThreadId ?? s.gmailThreadId ?? null,
      updatedAt: now,
      updatedBy: userId,
    })
    .where(eq(schema.tasks.id, t.id));

  const goals = await personalGoalMap(db, userId);
  if (!goals.get(t.id) && goals.get(s.id)) {
    await setPersonalGoal(db, userId, t.id, goals.get(s.id)!);
  }

  const sourceAuditNote = `[Merged into "${t.title}" (${t.id.slice(0, 8)}) on ${now.slice(0, 10)}]`;
  await db
    .update(schema.tasks)
    .set({
      isDeleted: true,
      notes: s.notes ? `${s.notes}\n\n${sourceAuditNote}` : sourceAuditNote,
      updatedAt: now,
      updatedBy: userId,
    })
    .where(eq(schema.tasks.id, s.id));

  await db
    .update(schema.taskUpdates)
    .set({ taskId: t.id, updatedAt: now })
    .where(eq(schema.taskUpdates.taskId, s.id));

  await db.insert(schema.taskUpdates).values({
    id: uuidv4(),
    taskId: t.id,
    authorId: userId,
    note: `Merged task '${s.title}' (${s.id.slice(0, 8)}) into this task.`,
    createdAt: now,
    updatedAt: now,
  });

  await logActivity(db, {
    actorId: userId,
    orgId: target.project.orgId,
    projectId: target.project.id,
    entityType: 'task',
    entityId: t.id,
    taskId: t.id,
    action: 'merged',
    summary: `Merged "${s.title}" into "${t.title}"`,
  });

  return getTaskView(db, userId, t.id);
}
