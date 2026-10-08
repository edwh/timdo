/**
 * @fileoverview Canonical TimDo V2 data contracts shared across the Next.js frontend.
 * @module app/types/project.types
 */

/**
 * All valid workflow states for a project card.
 * Soft deletion is represented via the `isDeleted` property on {@link Project}.
 */
export type ProjectStatus = 'do' | 'delay' | 'done' | 'delegate' | 'awaiting';

/**
 * Five-step effort sizing scale rendered as stars in the UI.
 */
export type ProjectSize = '*' | '**' | '***' | '****' | '*****';

/**
 * Authenticated user record mirrored from the Cloudflare D1 `Users` table.
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The signed-in user as returned by `GET /users/me`.
 */
export interface CurrentUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * A member's role in a workspace. Viewers can read everything but change nothing.
 */
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * A task as the API returns it (`TaskView` in docs/collaboration.md). The historical name
 * "Project" is kept across the frontend; `category` is the name of the task's project.
 */
export interface Project {
  id: string;
  userId: string;
  /** Id of the project (container) this task lives in. */
  projectId?: string;
  projectKey?: string | null;
  projectName?: string | null;
  /** Workspace the task's project belongs to. */
  orgId?: string | null;
  orgName?: string | null;
  /** True when the workspace has more than one member. */
  isShared?: boolean;
  myRole?: WorkspaceRole | null;
  /** False for viewers. Treat a missing value as editable (older API responses). */
  canEdit?: boolean;
  reporterId?: string | null;
  reporterName?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  updatedById?: string | null;
  updatedByName?: string | null;
  /** Assigned to me, or unassigned and created by me. */
  isMine?: boolean;
  title?: string;
  project: string;
  reason?: string;
  status: ProjectStatus;
  priority: number;
  size: ProjectSize;
  notes?: string;
  statusLastChangedOn?: string;
  awaitUntil?: string | null;
  gmailThreadId?: string | null;
  category?: string | null;
  epicId?: string | null;
  goalId?: string | null;
  customer?: string | null;
  tags?: string[] | string | null;
  linkedTasks?: Array<{
    id: string;
    shortId: string;
    title: string;
    status: string;
    priority: number;
    relationType: 'relates_to' | 'blocks' | 'blocked_by' | 'duplicates';
    reason?: string | null;
    direction?: 'outgoing' | 'incoming';
  }>;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Persisted project update/note record – matches D1 `ProjectUpdates` table shape.
 */
export interface ProjectUpdate {
  id: string;
  projectId: string;
  userId: string;
  authorId?: string;
  authorName?: string | null;
  note: string;
  gmailThreadId?: string | null;
  /** True for the note's author and for workspace owners/admins. */
  canDelete?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload used when creating a new project.
 */
export type ProjectCreateInput = Pick<
  Project,
  'project' | 'reason' | 'status' | 'priority' | 'size' | 'notes'
> & {
  awaitUntil?: string | null;
  gmailThreadId?: string | null;
  category?: string | null;
  /** Project (container) id. Takes precedence over `category` when both are sent. */
  projectId?: string | null;
  /** Defaults to the creator on the server; `null` creates an unassigned task. */
  assigneeId?: string | null;
  customer?: string | null;
  tags?: string[] | string | null;
  epicId?: string | null;
  goalId?: string | null;
};

/**
 * Flexible payload for updating a project.
 */
export type ProjectUpdateInput = Partial<
  Pick<
    Project,
    | 'project'
    | 'reason'
    | 'status'
    | 'priority'
    | 'size'
    | 'notes'
    | 'isDeleted'
    | 'gmailThreadId'
    | 'category'
    | 'epicId'
    | 'goalId'
    | 'projectId'
    | 'assigneeId'
    | 'customer'
    | 'tags'
  >
> & {
  statusLastChangedOn?: string;
  updatedAt?: string;
  awaitUntil?: string | null;
};

/**
 * Payload used for the optimistic batch updates triggered by drag-and-drop.
 */
export type ProjectBatchUpdateInput = {
  id: string;
  priority: number;
  status: ProjectStatus;
}[];
