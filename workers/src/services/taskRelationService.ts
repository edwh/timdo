import { and, eq, or } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '../db/schema';
import { AccessError, canEdit, getAccessibleProjects } from './accessService';
import { logActivity } from './activityService';
import { getUserAccessibleProjectIds, resolveTaskIdForUser } from './taskService';

/** Linking changes the source task, so the caller must be able to edit it. */
async function assertCanEditTask(db: DB, userId: string, taskId: string) {
  const task = await db
    .select({ projectId: schema.tasks.projectId, title: schema.tasks.title })
    .from(schema.tasks)
    .where(eq(schema.tasks.id, taskId))
    .get();
  const project = task
    ? (await getAccessibleProjects(db, userId)).find((p) => p.id === task.projectId)
    : undefined;
  if (!task || !project) {
    throw new AccessError('Task not found', 404);
  }
  if (!canEdit(project.role)) {
    throw new AccessError(`You have view-only access to "${project.name}"`);
  }
  return { task, project };
}

type DB = DrizzleD1Database<typeof schema>;

export type RelationType = 'relates_to' | 'blocks' | 'blocked_by' | 'duplicates';

export interface LinkedTaskInfo {
  id: string;
  shortId: string;
  title: string;
  status: string;
  priority: number;
  relationType: RelationType;
  reason?: string | null;
  direction: 'outgoing' | 'incoming';
}

/**
 * Tasks linked to this one. With a userId, links to tasks that person can't see are hidden.
 */
export async function getTaskRelations(
  db: DB,
  taskId: string,
  userId?: string
): Promise<LinkedTaskInfo[]> {
  const visible = userId ? new Set(await getUserAccessibleProjectIds(db, userId)) : null;
  // Query all relations where taskId is either source or target
  const relations = await db
    .select()
    .from(schema.taskRelations)
    .where(
      or(
        eq(schema.taskRelations.sourceTaskId, taskId),
        eq(schema.taskRelations.targetTaskId, taskId)
      )
    );

  if (relations.length === 0) {
    return [];
  }

  const linkedList: LinkedTaskInfo[] = [];

  for (const rel of relations) {
    const isSource = rel.sourceTaskId === taskId;
    const otherTaskId = isSource ? rel.targetTaskId : rel.sourceTaskId;

    const otherTask = await db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        status: schema.tasks.status,
        priority: schema.tasks.priority,
        isDeleted: schema.tasks.isDeleted,
        projectId: schema.tasks.projectId,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, otherTaskId))
      .get();

    if (!otherTask || otherTask.isDeleted) {
      continue;
    }
    if (visible && !visible.has(otherTask.projectId)) {
      continue;
    }

    let computedRelation: RelationType = rel.relationType as RelationType;
    if (!isSource) {
      // Invert relation when viewing from target perspective
      if (rel.relationType === 'blocks') {
        computedRelation = 'blocked_by';
      } else if (rel.relationType === 'blocked_by') {
        computedRelation = 'blocks';
      }
    }

    linkedList.push({
      id: otherTask.id,
      shortId: otherTask.id.slice(0, 8),
      title: otherTask.title,
      status: otherTask.status,
      priority: otherTask.priority,
      relationType: computedRelation,
      reason: rel.reason,
      direction: isSource ? 'outgoing' : 'incoming',
    });
  }

  return linkedList;
}

export async function linkTasks(
  db: DB,
  userId: string,
  sourceIdentifier: string,
  targetIdentifier: string,
  relationType: RelationType = 'relates_to',
  reason?: string
) {
  const sourceId = await resolveTaskIdForUser(db, userId, sourceIdentifier);
  const targetId = await resolveTaskIdForUser(db, userId, targetIdentifier);

  if (!sourceId || !targetId) {
    throw new Error('One or both tasks could not be found or are inaccessible');
  }

  if (sourceId === targetId) {
    throw new Error('Cannot link a task to itself');
  }
  const { task: source, project } = await assertCanEditTask(db, userId, sourceId);

  // Check if link already exists in either orientation
  const existing = await db
    .select()
    .from(schema.taskRelations)
    .where(
      or(
        and(
          eq(schema.taskRelations.sourceTaskId, sourceId),
          eq(schema.taskRelations.targetTaskId, targetId)
        ),
        and(
          eq(schema.taskRelations.sourceTaskId, targetId),
          eq(schema.taskRelations.targetTaskId, sourceId)
        )
      )
    )
    .get();

  if (existing) {
    // Update existing relation
    await db
      .update(schema.taskRelations)
      .set({
        relationType,
        reason: reason || existing.reason,
      })
      .where(eq(schema.taskRelations.id, existing.id));
    return { ...existing, relationType, reason: reason || existing.reason };
  }

  const newLink = {
    id: uuidv4(),
    sourceTaskId: sourceId,
    targetTaskId: targetId,
    relationType,
    reason: reason || null,
    createdBy: userId,
  };

  await db.insert(schema.taskRelations).values(newLink);
  // Never name the other task: it may sit in (or later move to) a workspace this log's readers can't see
  const targetLabel = `task ${targetId.slice(0, 8)}`;
  await logActivity(db, {
    actorId: userId,
    orgId: project.orgId,
    projectId: project.id,
    entityType: 'task',
    entityId: sourceId,
    taskId: sourceId,
    action: 'linked',
    summary: `Linked "${source.title}" to ${targetLabel} (${relationType.replace('_', ' ')})`,
  });
  return newLink;
}

export async function unlinkTasks(
  db: DB,
  userId: string,
  sourceIdentifier: string,
  targetIdentifier: string
) {
  const sourceId = await resolveTaskIdForUser(db, userId, sourceIdentifier);
  const targetId = await resolveTaskIdForUser(db, userId, targetIdentifier);

  if (!sourceId || !targetId) {
    return false;
  }
  await assertCanEditTask(db, userId, sourceId);

  await db
    .delete(schema.taskRelations)
    .where(
      or(
        and(
          eq(schema.taskRelations.sourceTaskId, sourceId),
          eq(schema.taskRelations.targetTaskId, targetId)
        ),
        and(
          eq(schema.taskRelations.sourceTaskId, targetId),
          eq(schema.taskRelations.targetTaskId, sourceId)
        )
      )
    );

  return true;
}
