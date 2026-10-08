/**
 * Voice commands in a multi-user TimDo.
 *
 * loadVoiceContext() gathers what the signed-in user can see: their workspaces with role,
 * the projects in each, the people they can assign to, their epics and tasks.
 * describeContextForPrompt() turns that into compact text for the LLM.
 * resolveProposals() checks the LLM's proposals against the same context: names become
 * ids, view-only and unknown targets are dropped or flagged, and each proposal gains the
 * labels the review screen shows (workspace, project, assignee).
 */
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { canEdit, getAccessibleProjects, type AccessibleProject, type Role } from './accessService';
import { getEpicsForUser } from './epicService';
import { getGoalsForUser } from './goalService';
import { getOrganisationMembers } from './organisationService';
import { getProjectsForUser, type TaskView } from './projectService';

type DB = DrizzleD1Database<typeof schema>;

export interface VoicePerson {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

export interface VoiceWorkspace {
  id: string;
  name: string;
  isPersonal: boolean;
  role: Role;
  canEdit: boolean;
  members: VoicePerson[];
  projects: AccessibleProject[];
}

export interface VoiceEpic {
  id: string;
  title: string;
  projectId: string | null;
  category: string | null;
  status: string;
}

export interface VoiceGoal {
  id: string;
  title: string;
}

/** A task as voice sees it: the TaskView fields we rely on, all optional except the basics. */
export type VoiceTask = Partial<TaskView> & {
  id: string;
  project: string;
  status: TaskView['status'];
  priority: number;
  size: TaskView['size'];
};

export interface VoiceContext {
  me: { id: string; name: string; email: string };
  workspaces: VoiceWorkspace[];
  projects: AccessibleProject[];
  tasks: VoiceTask[];
  epics: VoiceEpic[];
  goals: VoiceGoal[];
}

/* ------------------------------------------------------------------ loading */

/**
 * Load everything voice needs for this user. The client's cached task list is used when it
 * already carries workspace info (saves a read); otherwise the tasks come from the database.
 * Permissions always come from the database, never from the client.
 */
export async function loadVoiceContext(
  db: DB,
  userId: string,
  clientTasks?: unknown
): Promise<VoiceContext> {
  const [projects, meRow, epicsRaw, goalsRaw] = await Promise.all([
    getAccessibleProjects(db, userId),
    db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get(),
    getEpicsForUser(db, userId).catch(() => []),
    getGoalsForUser(db, userId).catch(() => []),
  ]);

  const orgIds = Array.from(new Set(projects.map((p) => p.orgId)));
  const memberLists = await Promise.all(orgIds.map((id) => getOrganisationMembers(db, id)));

  const workspaces: VoiceWorkspace[] = orgIds.map((orgId, i) => {
    const orgProjects = projects.filter((p) => p.orgId === orgId);
    const first = orgProjects[0];
    return {
      id: orgId,
      name: first.orgName,
      isPersonal: first.orgIsPersonal,
      role: first.role,
      canEdit: canEdit(first.role),
      projects: orgProjects,
      members: memberLists[i].map((m) => ({
        userId: m.userId,
        name: m.userName || m.userEmail.split('@')[0],
        email: m.userEmail,
        role: m.role as Role,
      })),
    };
  });
  // Personal first, then by name: matches how the rest of the app lists workspaces
  workspaces.sort(
    (a, b) => Number(b.isPersonal) - Number(a.isPersonal) || a.name.localeCompare(b.name)
  );

  let tasks: VoiceTask[];
  if (isUsableClientTaskList(clientTasks, projects)) {
    tasks = clientTasks;
  } else {
    tasks = await getProjectsForUser(db, userId);
  }

  const email = meRow?.email || '';
  return {
    me: { id: userId, name: meRow?.name || email.split('@')[0] || 'You', email },
    workspaces,
    projects,
    tasks,
    epics: (epicsRaw as any[]).map((e) => ({
      id: e.id,
      title: e.title,
      projectId: e.projectId ?? null,
      category: e.category ?? null,
      status: e.status,
    })),
    goals: (goalsRaw as any[]).map((g) => ({ id: g.id, title: g.title })),
  };
}

/** The client list is only trusted for task content, and only if it has the new shape. */
function isUsableClientTaskList(
  value: unknown,
  projects: AccessibleProject[]
): value is VoiceTask[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  const visible = new Set(projects.map((p) => p.id));
  return value.every(
    (t) =>
      t &&
      typeof t === 'object' &&
      typeof (t as any).id === 'string' &&
      typeof (t as any).projectId === 'string' &&
      visible.has((t as any).projectId)
  );
}

/* ------------------------------------------------------------------ prompt context */

function roleLabel(role: Role) {
  return role === 'viewer' ? 'viewer, VIEW ONLY' : role;
}

/** Workspaces, projects and people, as short lines the model can read. */
export function describeWorkspaces(ctx: VoiceContext): string {
  if (ctx.workspaces.length === 0) {
    return '(none yet)';
  }
  return ctx.workspaces
    .map((w) => {
      const kind = w.isPersonal ? 'personal' : 'shared';
      const projects = w.projects
        .filter((p) => !p.isArchived)
        .map((p) => `${p.name} [${p.key}]`)
        .join(', ');
      const people = w.members
        .map((m) => `${m.name}${m.userId === ctx.me.id ? ' (you)' : ''} <${m.email}> ${m.role}`)
        .join('; ');
      return [
        `- Workspace "${w.name}" (${kind}, your role: ${roleLabel(w.role)})`,
        `  Projects: ${projects || '(none)'}`,
        `  People you can assign to: ${people}`,
      ].join('\n');
    })
    .join('\n');
}

export function describeEpics(ctx: VoiceContext): string {
  const byId = new Map(ctx.projects.map((p) => [p.id, p]));
  const active = ctx.epics.filter((e) => e.status !== 'completed');
  if (active.length === 0) {
    return '(none)';
  }
  return active
    .map((e) => {
      const project = e.projectId ? byId.get(e.projectId)?.name : e.category;
      return `- "${e.title}"${project ? ` in ${project}` : ''}`;
    })
    .join('\n');
}

/** How many done tasks the model sees (most recently finished first) */
const DONE_TASK_LIMIT = 100;
/** Long notes are cut to this many characters */
const TEXT_LIMIT = 160;

const clip = (text: string | null | undefined) =>
  text && text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT)}...` : text || undefined;

/**
 * Tasks in a compact shape: enough to find, update and answer questions about them.
 * Open tasks carry clipped notes; done tasks are trimmed to the most recent ones with just
 * their title, project and assignee, which keeps the prompt small for busy accounts.
 */
export function compactTasks(ctx: VoiceContext) {
  const byId = new Map(ctx.projects.map((p) => [p.id, p]));
  const epicTitles = new Map(ctx.epics.map((e) => [e.id, e.title]));
  const live = ctx.tasks.filter((t) => !t.isDeleted);
  const open = live.filter((t) => t.status !== 'done');
  const done = live
    .filter((t) => t.status === 'done')
    .sort((a, b) =>
      String(b.statusLastChangedOn || b.updatedAt || '').localeCompare(
        String(a.statusLastChangedOn || a.updatedAt || '')
      )
    )
    .slice(0, DONE_TASK_LIMIT);

  return [...open, ...done].map((t) => {
    const project = t.projectId ? byId.get(t.projectId) : undefined;
    const base = {
      id: t.id,
      project: t.project,
      status: t.status,
      category: project?.name ?? t.category ?? null,
      workspace: project?.orgName ?? t.orgName ?? null,
      assignee: t.assigneeName ?? (t.assigneeId ? 'someone' : 'unassigned'),
      ...(project && !canEdit(project.role) ? { viewOnly: true } : {}),
    };
    if (t.status === 'done') {
      return base;
    }
    return {
      ...base,
      priority: t.priority,
      size: t.size,
      ...(t.reason ? { reason: clip(t.reason) } : {}),
      ...(t.notes ? { notes: clip(t.notes) } : {}),
      ...(t.awaitUntil ? { awaitUntil: t.awaitUntil } : {}),
      ...(t.epicId && epicTitles.has(t.epicId) ? { epic: epicTitles.get(t.epicId) } : {}),
    };
  });
}

/* ------------------------------------------------------------------ matching helpers */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Pick the candidates whose label best matches the spoken text: exact first, then the
 * same letters ignoring spaces and punctuation ("Sol fit" = "Solfit"), then a near miss
 * of at most two letters for longer names (Whisper mishearing).
 */
function bestMatches<T>(spoken: string, items: T[], labels: (item: T) => string[]): T[] {
  const s = spoken.trim().toLowerCase();
  const n = norm(spoken);
  if (!n) {
    return [];
  }
  const tiers: Array<(label: string) => boolean> = [
    (l) => l.trim().toLowerCase() === s,
    (l) => norm(l) === n,
    (l) => n.length >= 5 && norm(l).length >= 5 && levenshtein(norm(l), n) <= 2,
  ];
  for (const test of tiers) {
    const hits = items.filter((item) => labels(item).some(test));
    if (hits.length > 0) {
      return hits;
    }
  }
  return [];
}

const ME_WORDS = new Set(['me', 'myself', 'mine', 'i', 'my']);
const NOBODY_WORDS = new Set(['unassigned', 'nobody', 'noone', 'none', 'no one', 'null']);

type PersonMatch =
  | { kind: 'me' }
  | { kind: 'nobody' }
  | { kind: 'person'; person: VoicePerson }
  | { kind: 'ambiguous'; people: VoicePerson[] }
  | { kind: 'none' };

/** Match a spoken name or email against a list of people. */
export function matchPerson(spoken: string, people: VoicePerson[], meId: string): PersonMatch {
  const raw = spoken.trim().toLowerCase();
  if (!raw) {
    return { kind: 'none' };
  }
  if (ME_WORDS.has(raw)) {
    return { kind: 'me' };
  }
  if (NOBODY_WORDS.has(raw) || NOBODY_WORDS.has(raw.replace(/-/g, ' '))) {
    return { kind: 'nobody' };
  }

  const pick = (hits: VoicePerson[]): PersonMatch | null => {
    const unique = Array.from(new Map(hits.map((p) => [p.userId, p])).values());
    if (unique.length === 1) {
      return unique[0].userId === meId ? { kind: 'me' } : { kind: 'person', person: unique[0] };
    }
    if (unique.length > 1) {
      return { kind: 'ambiguous', people: unique };
    }
    return null;
  };

  const first = (p: VoicePerson) => p.name.trim().split(/\s+/)[0] || '';
  const last = (p: VoicePerson) => {
    const parts = p.name.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };
  const n = norm(raw);
  const tests: Array<(p: VoicePerson) => boolean> = [
    (p) => p.email.toLowerCase() === raw,
    (p) => p.name.trim().toLowerCase() === raw || norm(p.name) === n,
    (p) => norm(first(p)) === n,
    (p) => !!last(p) && norm(last(p)) === n,
    (p) => norm(p.email.split('@')[0]) === n,
    // "Rob" for Robin, "Robin H" for Robin Fairweather
    (p) => n.length >= 2 && (norm(first(p)).startsWith(n) || norm(p.name).startsWith(n)),
    (p) => n.length >= 5 && levenshtein(norm(first(p)), n) <= 1,
  ];
  for (const test of tests) {
    const result = pick(people.filter(test));
    if (result) {
      return result;
    }
  }
  return { kind: 'none' };
}

/** "Robin" or "Sam Smith or Sam Jones" */
function listNames(people: VoicePerson[]) {
  const names = people.map((p) => p.name);
  if (names.length <= 2) {
    return names.join(' or ');
  }
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/* ------------------------------------------------------------------ resolution */

export type ChangeType = 'create' | 'update' | 'delete' | 'createEpic' | 'createProject' | 'claim';

/** What the model returns for one change (loosely typed: it is model output). */
export interface RawChange {
  type: ChangeType;
  projectId?: string;
  after?: Record<string, any> | null;
}

export interface ResolvedProposal {
  type: ChangeType;
  /** The existing task, for update, delete and claim */
  before: VoiceTask | null;
  /** The proposed task, epic or project fields */
  after: Record<string, any> | null;
  /** Existing task id, for update, delete and claim */
  taskId: string | null;
  /** The project (container) this lands in. null when it will be created on apply. */
  projectId: string | null;
  projectName: string | null;
  orgId: string | null;
  orgName: string | null;
  /** True when applying this creates a new project (from the category name) */
  isNewProject: boolean;
  /** undefined = leave as is (or the API default), null = unassigned */
  assigneeId?: string | null;
  assigneeName: string | null;
  assigneeChanged: boolean;
  epicId: string | null;
  epicTitle: string | null;
  goalId: string | null;
  /** Problems with this change, also included in the response's warnings */
  warnings: string[];
}

export interface ResolveResult {
  proposals: ResolvedProposal[];
  warnings: string[];
}

function personalWorkspace(ctx: VoiceContext) {
  return ctx.workspaces.find((w) => w.isPersonal && w.role === 'owner') ?? null;
}

function workspaceFor(ctx: VoiceContext, orgId: string | null | undefined) {
  return orgId ? (ctx.workspaces.find((w) => w.id === orgId) ?? null) : null;
}

type ProjectTarget =
  | { kind: 'project'; project: AccessibleProject }
  | { kind: 'new'; name: string; workspace: VoiceWorkspace | null }
  | { kind: 'viewOnly'; project: AccessibleProject }
  | { kind: 'none' };

/**
 * Find the project a change is aimed at. Tries the explicit id or key, then the category
 * name. When a name exists in several workspaces, prefers ones the user can edit, then
 * one where the intended assignee is a member.
 */
function resolveProjectTarget(
  ctx: VoiceContext,
  category: string | null | undefined,
  idOrKey: string | null | undefined,
  assigneeHint: string | null | undefined,
  warnings: string[]
): ProjectTarget {
  const live = ctx.projects.filter((p) => !p.isArchived);
  if (idOrKey) {
    const k = idOrKey.trim().toLowerCase();
    const byId = ctx.projects.find((p) => p.id === idOrKey || p.key.toLowerCase() === k);
    if (byId) {
      return canEdit(byId.role)
        ? { kind: 'project', project: byId }
        : { kind: 'viewOnly', project: byId };
    }
  }
  const name = (category || '').trim();
  if (!name) {
    return { kind: 'none' };
  }

  let hits = bestMatches(name, live, (p) => [p.name, p.key]);
  if (hits.length === 0) {
    hits = bestMatches(name, ctx.projects, (p) => [p.name, p.key]);
  }
  if (hits.length === 0) {
    return { kind: 'new', name, workspace: personalWorkspace(ctx) };
  }

  const editable = hits.filter((p) => canEdit(p.role));
  if (editable.length === 0) {
    return { kind: 'viewOnly', project: hits[0] };
  }
  if (editable.length === 1) {
    return { kind: 'project', project: editable[0] };
  }

  if (assigneeHint) {
    const withAssignee = editable.filter((p) => {
      const ws = workspaceFor(ctx, p.orgId);
      const m = ws ? matchPerson(assigneeHint, ws.members, ctx.me.id) : { kind: 'none' };
      return m.kind === 'person' || m.kind === 'me';
    });
    if (withAssignee.length === 1) {
      return { kind: 'project', project: withAssignee[0] };
    }
  }
  const chosen = editable[0];
  warnings.push(
    `There's a "${chosen.name}" project in ${editable.map((p) => p.orgName).join(' and ')}. I used the one in ${chosen.orgName}.`
  );
  return { kind: 'project', project: chosen };
}

interface AssigneeOutcome {
  /** undefined = no change requested */
  assigneeId?: string | null;
  assigneeName: string | null;
}

/**
 * Resolve the spoken assignee against the members of the target workspace.
 * Unresolvable names fall back to `fallback` and add a warning saying what happened.
 */
function resolveAssignee(
  ctx: VoiceContext,
  spoken: string | null | undefined,
  workspace: VoiceWorkspace | null,
  fallback: { assigneeId?: string | null; assigneeName: string | null; label: string },
  warnings: string[]
): AssigneeOutcome {
  if (spoken === undefined || spoken === null || !String(spoken).trim()) {
    return { assigneeId: fallback.assigneeId, assigneeName: fallback.assigneeName };
  }
  const members = workspace?.members ?? [
    { userId: ctx.me.id, name: ctx.me.name, email: ctx.me.email, role: 'owner' as Role },
  ];
  const match = matchPerson(String(spoken), members, ctx.me.id);
  const wsName = workspace?.name ?? 'your personal';
  if (match.kind === 'me') {
    return { assigneeId: ctx.me.id, assigneeName: ctx.me.name };
  }
  if (match.kind === 'nobody') {
    return { assigneeId: null, assigneeName: null };
  }
  if (match.kind === 'person') {
    return { assigneeId: match.person.userId, assigneeName: match.person.name };
  }
  if (match.kind === 'ambiguous') {
    warnings.push(
      `"${spoken}" could be ${listNames(match.people)}, so I ${fallback.label}. Pick the person on the task.`
    );
    return { assigneeId: fallback.assigneeId, assigneeName: fallback.assigneeName };
  }
  // Not in this workspace: say whether they are someone the user knows elsewhere
  const everyone = Array.from(
    new Map(ctx.workspaces.flatMap((w) => w.members).map((p) => [p.userId, p])).values()
  );
  const elsewhere = matchPerson(String(spoken), everyone, ctx.me.id);
  if (elsewhere.kind === 'person') {
    warnings.push(
      `${elsewhere.person.name} isn't in the ${wsName} workspace, so I ${fallback.label}.`
    );
  } else {
    warnings.push(
      `I couldn't find anyone called "${spoken}" in the ${wsName} workspace, so I ${fallback.label}.`
    );
  }
  return { assigneeId: fallback.assigneeId, assigneeName: fallback.assigneeName };
}

function resolveEpic(
  ctx: VoiceContext,
  title: string | null | undefined,
  projectId: string | null,
  categoryName: string | null,
  pendingEpicTitles: string[],
  warnings: string[]
): { epicId: string | null; epicTitle: string | null } {
  if (!title || !title.trim()) {
    return { epicId: null, epicTitle: null };
  }
  const inScope = ctx.epics.filter((e) =>
    projectId
      ? e.projectId === projectId
      : !e.projectId && (e.category || '').toLowerCase() === (categoryName || '').toLowerCase()
  );
  const hits = bestMatches(title, inScope, (e) => [e.title]);
  if (hits.length >= 1) {
    return { epicId: hits[0].id, epicTitle: hits[0].title };
  }
  // Created earlier in this same command: the review screen links it once it exists
  const pending = pendingEpicTitles.find((t) => norm(t) === norm(title));
  if (pending) {
    return { epicId: null, epicTitle: pending };
  }
  const where = categoryName ? ` in ${categoryName}` : '';
  warnings.push(`There's no "${title}" epic${where}, so the task won't be linked to an epic.`);
  return { epicId: null, epicTitle: null };
}

function resolveGoal(ctx: VoiceContext, title: string | null | undefined, warnings: string[]) {
  if (!title || !title.trim()) {
    return null;
  }
  const hits = bestMatches(title, ctx.goals, (g) => [g.title]);
  if (hits.length >= 1) {
    return hits[0].id;
  }
  warnings.push(`I couldn't find a life goal called "${title}", so I didn't link one.`);
  return null;
}

function taskLabel(after: Record<string, any> | null | undefined, before?: VoiceTask | null) {
  return `"${(after?.project || before?.project || 'that task').toString().trim()}"`;
}

function findTask(ctx: VoiceContext, id: string | undefined, after?: Record<string, any> | null) {
  if (id) {
    const exact = ctx.tasks.find((t) => t.id === id && !t.isDeleted);
    if (exact) {
      return exact;
    }
    const prefix = id.length >= 6 ? ctx.tasks.filter((t) => t.id.startsWith(id)) : [];
    if (prefix.length === 1) {
      return prefix[0];
    }
  }
  if (after?.id && after.id !== id) {
    const byAfterId = ctx.tasks.find((t) => t.id === after.id && !t.isDeleted);
    if (byAfterId) {
      return byAfterId;
    }
  }
  return null;
}

/**
 * Check and enrich the model's proposals. Never throws: anything it can't do safely is
 * dropped or left unresolved, with a plain-English warning.
 */
export function resolveProposals(changes: RawChange[], ctx: VoiceContext): ResolveResult {
  const proposals: ResolvedProposal[] = [];
  const allWarnings: string[] = [];
  const projectById = new Map(ctx.projects.map((p) => [p.id, p]));
  const pendingEpicTitles = changes
    .filter((c) => c.type === 'createEpic' && c.after?.project)
    .map((c) => String(c.after!.project).trim());
  const pendingProjectNames = changes
    .filter((c) => c.type === 'createProject' && c.after?.project)
    .map((c) => String(c.after!.project).trim().toLowerCase());

  for (const change of changes) {
    const warnings: string[] = [];
    const after = change.after ? { ...change.after } : null;
    const base = {
      type: change.type,
      before: null as VoiceTask | null,
      after,
      taskId: null as string | null,
      projectId: null as string | null,
      projectName: null as string | null,
      orgId: null as string | null,
      orgName: null as string | null,
      isNewProject: false,
      assigneeName: null as string | null,
      assigneeChanged: false,
      epicId: null as string | null,
      epicTitle: null as string | null,
      goalId: null as string | null,
    };
    const drop = (message: string) => {
      allWarnings.push(...warnings, message);
    };
    const keep = (p: ResolvedProposal) => {
      p.warnings = warnings;
      allWarnings.push(...warnings);
      proposals.push(p);
    };

    /* ---------- new project (container) ---------- */
    if (change.type === 'createProject') {
      const name = String(after?.project || after?.category || '').trim();
      if (!name) {
        drop("I couldn't tell what the new project should be called, so I left it out.");
        continue;
      }
      const spokenWs = after?.workspace ? String(after.workspace) : '';
      let ws: VoiceWorkspace | null = null;
      if (spokenWs) {
        const hits = bestMatches(spokenWs, ctx.workspaces, (w) => [w.name]);
        ws = hits[0] ?? null;
        if (!ws) {
          warnings.push(`There's no "${spokenWs}" workspace, so I put it in your personal one.`);
        }
      }
      ws = ws ?? personalWorkspace(ctx);
      if (ws && !ws.canEdit) {
        drop(
          `You have view-only access to the ${ws.name} workspace, so I didn't add the "${name}" project.`
        );
        continue;
      }
      const clash = ws?.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (clash) {
        drop(`There's already a "${clash.name}" project in ${ws!.name}, so I didn't add another.`);
        continue;
      }
      keep({
        ...base,
        after: { ...(after || {}), project: name },
        projectName: name,
        orgId: ws?.id ?? null,
        orgName: ws?.name ?? null,
        isNewProject: true,
        warnings: [],
      });
      continue;
    }

    /* ---------- existing task: update, delete, claim ---------- */
    let before: VoiceTask | null = null;
    if (change.type === 'update' || change.type === 'delete' || change.type === 'claim') {
      before = findTask(ctx, change.projectId, after);
      if (!before) {
        drop(`I couldn't find the task ${taskLabel(after)}, so I left that change out.`);
        continue;
      }
      const current = before.projectId ? projectById.get(before.projectId) : undefined;
      if (current && !canEdit(current.role)) {
        drop(
          `You have view-only access to "${current.name}", so I can't change ${taskLabel(null, before)}.`
        );
        continue;
      }
      base.before = before;
      base.taskId = before.id;
      base.projectId = before.projectId ?? null;
      base.projectName = current?.name ?? before.projectName ?? before.category ?? null;
      base.orgId = current?.orgId ?? before.orgId ?? null;
      base.orgName = current?.orgName ?? before.orgName ?? null;
      base.assigneeName = before.assigneeName ?? null;
      base.epicId = before.epicId ?? null;
      base.epicTitle = before.epicId
        ? (ctx.epics.find((e) => e.id === before!.epicId)?.title ?? null)
        : null;
      base.goalId = before.goalId ?? null;
    }

    if (change.type === 'delete') {
      keep({ ...base, after: null, warnings: [] });
      continue;
    }

    if (change.type === 'claim') {
      const ws = workspaceFor(ctx, base.orgId);
      if (ws && !ws.members.some((m) => m.userId === ctx.me.id)) {
        drop(
          `You aren't in the ${ws.name} workspace, so you can't claim ${taskLabel(null, before)}.`
        );
        continue;
      }
      if (before!.assigneeId === ctx.me.id) {
        drop(`${taskLabel(null, before)} is already yours.`);
        continue;
      }
      if (before!.assigneeId && before!.assigneeName) {
        warnings.push(
          `${taskLabel(null, before)} is assigned to ${before!.assigneeName} at the moment.`
        );
      }
      keep({
        ...base,
        after: { ...before, ...(after || {}), id: before!.id, assignee: 'me' },
        assigneeId: ctx.me.id,
        assigneeName: ctx.me.name,
        assigneeChanged: true,
        warnings: [],
      });
      continue;
    }

    /* ---------- create, update, createEpic: where does it go? ---------- */
    const spokenCategory: string | null = after?.category ? String(after.category) : null;
    const spokenKey: string | null =
      after?.projectId && after.projectId !== before?.projectId ? String(after.projectId) : null;
    const assigneeHint: string | null = after?.assignee ? String(after.assignee) : null;
    const wantsMove =
      change.type === 'update' &&
      !!before &&
      ((spokenKey && spokenKey !== before.projectId) ||
        (spokenCategory &&
          norm(spokenCategory) !== norm(base.projectName || before.category || '')));

    let targetProject: AccessibleProject | null =
      change.type === 'update' && base.projectId ? (projectById.get(base.projectId) ?? null) : null;
    let isNewProject = false;
    let newProjectName: string | null = null;
    let targetWorkspace: VoiceWorkspace | null = workspaceFor(ctx, base.orgId);

    if (change.type !== 'update' || wantsMove) {
      const target = resolveProjectTarget(ctx, spokenCategory, spokenKey, assigneeHint, warnings);
      const what =
        change.type === 'createEpic'
          ? `the "${after?.project ?? ''}" epic`
          : taskLabel(after, before);
      if (target.kind === 'viewOnly') {
        drop(`You have view-only access to "${target.project.name}", so I left out ${what}.`);
        continue;
      }
      if (target.kind === 'project') {
        targetProject = target.project;
        targetWorkspace = workspaceFor(ctx, target.project.orgId);
      } else if (target.kind === 'new') {
        isNewProject = true;
        newProjectName = target.name;
        targetProject = null;
        targetWorkspace = target.workspace;
        if (!pendingProjectNames.includes(target.name.toLowerCase())) {
          warnings.push(
            `There's no "${target.name}" project yet, so applying ${what} will create it in your personal workspace.`
          );
        }
      } else if (change.type !== 'update') {
        // No project mentioned: the API files it under General in the personal workspace
        const general = ctx.projects.find(
          (p) => p.name.toLowerCase() === 'general' && canEdit(p.role) && p.orgIsPersonal
        );
        if (general) {
          targetProject = general;
          targetWorkspace = workspaceFor(ctx, general.orgId);
        } else {
          isNewProject = true;
          newProjectName = 'General';
          targetWorkspace = personalWorkspace(ctx);
        }
      }
    }

    const projectId = targetProject?.id ?? null;
    const projectName = targetProject?.name ?? newProjectName ?? base.projectName;
    const orgId = targetProject?.orgId ?? targetWorkspace?.id ?? null;
    const orgName = targetProject?.orgName ?? targetWorkspace?.name ?? null;

    if (change.type === 'createEpic') {
      const title = String(after?.project || '').trim();
      if (!title) {
        drop("I couldn't tell what the new epic should be called, so I left it out.");
        continue;
      }
      keep({
        ...base,
        after: { ...(after || {}), project: title, category: projectName },
        projectId,
        projectName,
        orgId,
        orgName,
        isNewProject,
        warnings: [],
      });
      continue;
    }

    /* ---------- assignee ---------- */
    let assignee: AssigneeOutcome;
    if (change.type === 'create') {
      assignee = resolveAssignee(
        ctx,
        assigneeHint,
        targetWorkspace,
        { assigneeId: null, assigneeName: null, label: 'left it unassigned' },
        warnings
      );
      if (!assigneeHint) {
        // The API assigns new tasks to their creator
        assignee = { assigneeId: ctx.me.id, assigneeName: ctx.me.name };
      }
    } else {
      const keepCurrent = {
        assigneeId: undefined,
        assigneeName: before!.assigneeName ?? null,
        label: "didn't change who it's assigned to",
      };
      // The model often echoes the task's current assignee back: that isn't a request
      const echoed =
        !!assigneeHint &&
        [before!.assigneeName ?? 'unassigned', 'someone'].some(
          (n) => norm(n) === norm(assigneeHint)
        );
      assignee = resolveAssignee(
        ctx,
        echoed ? null : assigneeHint,
        targetWorkspace,
        keepCurrent,
        warnings
      );
      // Moving to another workspace: the current assignee has to be a member there too
      if (
        assignee.assigneeId === undefined &&
        before!.assigneeId &&
        targetWorkspace &&
        orgId !== base.orgId &&
        !targetWorkspace.members.some((m) => m.userId === before!.assigneeId)
      ) {
        warnings.push(
          `${before!.assigneeName ?? 'The current assignee'} isn't in the ${targetWorkspace.name} workspace, so moving it there leaves it unassigned.`
        );
        assignee = { assigneeId: null, assigneeName: null };
      }
      if (
        assignee.assigneeId !== undefined &&
        assignee.assigneeId === (before!.assigneeId ?? null)
      ) {
        assignee = { assigneeId: undefined, assigneeName: before!.assigneeName ?? null };
      }
    }

    /* ---------- epic and goal ---------- */
    const epicChanged =
      after?.epicTitle && norm(String(after.epicTitle)) !== norm(base.epicTitle || '');
    const epic =
      change.type === 'create' || epicChanged
        ? resolveEpic(ctx, after?.epicTitle, projectId, projectName, pendingEpicTitles, warnings)
        : { epicId: base.epicId, epicTitle: base.epicTitle };
    const goalId =
      after?.goalTitle !== undefined && after?.goalTitle !== null
        ? resolveGoal(ctx, after.goalTitle, warnings)
        : base.goalId;

    // The model saw clipped notes: if it echoed them back, keep the full text
    if (after && before) {
      for (const field of ['notes', 'reason'] as const) {
        const full = before[field];
        const echoed = after[field];
        if (
          typeof full === 'string' &&
          typeof echoed === 'string' &&
          echoed !== full &&
          echoed.endsWith('...') &&
          full.startsWith(echoed.slice(0, -3))
        ) {
          after[field] = full;
        }
      }
    }

    const resolvedAfter = {
      ...(after || {}),
      category: projectName,
      projectId: projectId ?? undefined,
      projectName,
      orgName,
      ...(assignee.assigneeId !== undefined ? { assigneeId: assignee.assigneeId } : {}),
      assigneeName: assignee.assigneeName,
      epicId: epic.epicId,
      epicTitle: epic.epicTitle,
      goalId,
    };

    keep({
      ...base,
      after: resolvedAfter,
      projectId,
      projectName,
      orgId,
      orgName,
      isNewProject,
      assigneeId: assignee.assigneeId,
      assigneeName: assignee.assigneeName,
      assigneeChanged: change.type === 'create' ? true : assignee.assigneeId !== undefined,
      epicId: epic.epicId,
      epicTitle: epic.epicTitle,
      goalId,
      warnings: [],
    });
  }

  return { proposals, warnings: Array.from(new Set(allWarnings)) };
}
