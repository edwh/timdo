/**
 * Apply one reviewed voice change through the API, using the ids the server resolved
 * (projectId, assigneeId, epicId). Failures throw VoiceApplyError with the API's own
 * message, e.g. `You have view-only access to "Solfit"`.
 */
import type { VoiceProposal } from '../../../components/VoiceCommand/voiceTypes';
import { apiFetch } from '../../lib/apiClient';
import { getWorkerApiBaseUrl } from '../../lib/apiConfig';

export class VoiceApplyError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Ids created earlier in the same review, so later changes can link to them. */
export interface ApplySession {
  epicIdsByTitle: Record<string, string>;
  projectIdsByName: Record<string, string>;
}

export const newApplySession = (): ApplySession => ({ epicIdsByTitle: {}, projectIdsByName: {} });

export interface ApplyOutcome {
  /** Short line for the success notification */
  message: string;
}

const key = (s: string) => s.trim().toLowerCase();

/** Drop null and undefined so the API's optional fields validate. */
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) {
      out[k] = v;
    }
  }
  return out as Partial<T>;
}

function inThirtyDays() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

async function readError(response: Response, fallback: string): Promise<VoiceApplyError> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
  } | null;
  const text =
    typeof body?.error === 'string'
      ? body.error
      : typeof body?.message === 'string'
        ? body.message
        : null;
  if (text) {
    return new VoiceApplyError(text, response.status);
  }
  if (response.status === 400) {
    return new VoiceApplyError(`${fallback}: some of the details weren't valid.`, 400);
  }
  if (response.status === 403) {
    return new VoiceApplyError("You don't have permission to do that.", 403);
  }
  if (response.status === 404) {
    return new VoiceApplyError("That task isn't there any more, or you can't see it.", 404);
  }
  return new VoiceApplyError(fallback, response.status);
}

async function send(
  token: string,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  fallback: string
) {
  const response = await apiFetch(`${getWorkerApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    throw await readError(response, fallback);
  }
  return response.json().catch(() => ({}));
}

/** Where a change lands: an id when known, else the project name (the API then creates it). */
function placement(change: VoiceProposal, session: ApplySession) {
  if (change.projectId) {
    return { projectId: change.projectId };
  }
  const name = change.projectName || change.after?.category || undefined;
  if (name && session.projectIdsByName[key(name)]) {
    return { projectId: session.projectIdsByName[key(name)] };
  }
  return name ? { category: name } : {};
}

function epicFor(change: VoiceProposal, session: ApplySession) {
  if (change.epicId) {
    return change.epicId;
  }
  if (change.epicTitle) {
    return session.epicIdsByTitle[key(change.epicTitle)];
  }
  return undefined;
}

function where(change: VoiceProposal) {
  return change.projectName ? ` in ${change.projectName}` : '';
}

export async function applyVoiceChange(
  change: VoiceProposal,
  token: string,
  session: ApplySession,
  meId?: string | null
): Promise<ApplyOutcome> {
  const after = change.after;
  const taskId = change.taskId || change.before?.id;

  switch (change.type) {
    case 'createProject': {
      const name = (after?.project || change.projectName || '').trim();
      if (!change.orgId) {
        throw new VoiceApplyError('There is no workspace to add this project to.', 400);
      }
      const created = (await send(
        token,
        'POST',
        `/organisations/${change.orgId}/projects`,
        clean({ name, description: after?.notes || after?.reason }),
        `Couldn't add the "${name}" project`
      )) as { id?: string };
      if (created?.id) {
        session.projectIdsByName[key(name)] = created.id;
      }
      return { message: `Added the ${name} project to ${change.orgName ?? 'your workspace'}` };
    }

    case 'createEpic': {
      const title = (after?.project || '').trim();
      const created = (await send(
        token,
        'POST',
        '/epics',
        clean({
          title,
          description: after?.notes || after?.reason,
          status: 'active',
          ...placement(change, session),
        }),
        `Couldn't add the "${title}" epic`
      )) as { id?: string };
      if (created?.id) {
        session.epicIdsByTitle[key(title)] = created.id;
      }
      return { message: `Added the "${title}" epic${where(change)}` };
    }

    case 'create': {
      if (!after) {
        throw new VoiceApplyError('This change has no task details.', 400);
      }
      const status = after.status ?? 'do';
      const body = clean({
        project: after.project,
        reason: after.reason,
        status,
        priority: Math.min(10, Math.max(1, Math.round(after.priority ?? 5))),
        size: after.size ?? '***',
        notes: after.notes,
        awaitUntil: status === 'awaiting' ? after.awaitUntil || inThirtyDays() : undefined,
        customer: after.customer,
        tags: after.tags,
        epicId: epicFor(change, session),
        goalId: change.goalId,
        ...placement(change, session),
      });
      // null is meaningful here (unassigned), so add it after cleaning
      const payload =
        change.assigneeId !== undefined ? { ...body, assigneeId: change.assigneeId } : body;
      await send(token, 'POST', '/projects', payload, `Couldn't add "${after.project}"`);
      const forWhom =
        change.assigneeId && change.assigneeId !== meId && change.assigneeName
          ? ` for ${change.assigneeName}`
          : '';
      return { message: `Added "${after.project}"${where(change)}${forWhom}` };
    }

    case 'update': {
      if (!after || !taskId) {
        throw new VoiceApplyError('This change has no task to update.', 400);
      }
      const before = change.before;
      const status = after.status ?? before?.status;
      const moved = !!change.projectId && change.projectId !== before?.projectId;
      const proposed = clean({
        project: after.project,
        reason: after.reason,
        status,
        priority:
          after.priority !== undefined
            ? Math.min(10, Math.max(1, Math.round(after.priority)))
            : undefined,
        size: after.size,
        notes: after.notes,
        customer: after.customer,
        tags: after.tags,
      });
      // Send only what changed, so the activity log shows the real edit
      const body: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(proposed)) {
        if (!before || (before as unknown as Record<string, unknown>)[field] !== value) {
          body[field] = value;
        }
      }
      if (status === 'awaiting') {
        const awaitUntil = after.awaitUntil || before?.awaitUntil || inThirtyDays();
        if (awaitUntil !== before?.awaitUntil || before?.status !== 'awaiting') {
          body.awaitUntil = awaitUntil;
          body.status = 'awaiting';
        }
      }
      if (moved) {
        body.projectId = change.projectId;
      } else if (!change.projectId && change.isNewProject) {
        Object.assign(body, placement(change, session));
      }
      if (change.assigneeId !== undefined) {
        body.assigneeId = change.assigneeId;
      }
      const epicId = epicFor(change, session);
      if (epicId && epicId !== before?.epicId) {
        body.epicId = epicId;
      }
      if (change.goalId && change.goalId !== before?.goalId) {
        body.goalId = change.goalId;
      }
      const title = after.project || before?.project || 'the task';
      if (Object.keys(body).length === 0) {
        return { message: `"${title}" was already up to date` };
      }
      await send(token, 'PUT', `/projects/${taskId}`, body, `Couldn't update "${title}"`);
      return { message: `Updated "${title}"` };
    }

    case 'claim': {
      if (!taskId) {
        throw new VoiceApplyError('This change has no task to claim.', 400);
      }
      const assigneeId = change.assigneeId ?? meId;
      if (!assigneeId) {
        throw new VoiceApplyError("Couldn't work out who you are. Try again.", 400);
      }
      const title = change.before?.project ?? after?.project ?? 'the task';
      await send(token, 'PUT', `/projects/${taskId}`, { assigneeId }, `Couldn't claim "${title}"`);
      return { message: `"${title}" is yours now` };
    }

    case 'delete': {
      if (!taskId) {
        throw new VoiceApplyError('This change has no task to delete.', 400);
      }
      const title = change.before?.project ?? 'the task';
      await send(token, 'DELETE', `/projects/${taskId}`, undefined, `Couldn't delete "${title}"`);
      return { message: `Deleted "${title}"` };
    }

    default:
      throw new VoiceApplyError("TimDo doesn't know how to apply that change.", 400);
  }
}
