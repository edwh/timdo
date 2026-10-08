import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { getAccessibleProjects, getUserNames } from './accessService';

type DB = DrizzleD1Database<typeof schema>;

export interface SearchResult {
  id: string;
  shortId: string;
  title: string;
  reason?: string | null;
  status: string;
  priority: number;
  customer?: string | null;
  tags?: string | null;
  snippet?: string;
  score: number;
  projectId: string;
  projectName: string | null;
  orgId: string | null;
  orgName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
}

export async function searchTasksForUser(
  db: DB,
  userId: string,
  query: string,
  includeDone: boolean = false,
  customerFilter?: string
): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return [];
  }

  const accessible = await getAccessibleProjects(db, userId);
  const projectsById = new Map(accessible.map((p) => [p.id, p]));
  const accessibleProjectIds = accessible.map((p) => p.id);
  if (accessibleProjectIds.length === 0) {
    return [];
  }

  // Sanitize query for FTS5: wrap tokens with asterisks or quotes to prevent syntax crashes
  const sanitized = cleanQuery
    .replace(/['"/*]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w}"*`)
    .join(' ');

  if (!sanitized) {
    return [];
  }

  const conditions = [
    sql`Tasks_FTS MATCH ${sanitized}`,
    eq(schema.tasks.isDeleted, false),
    inArray(schema.tasks.projectId, accessibleProjectIds),
  ];
  if (!includeDone) {
    conditions.push(sql`${schema.tasks.status} != 'done'`);
  }
  if (customerFilter) {
    conditions.push(sql`lower(${schema.tasks.customer}) = lower(${customerFilter.trim()})`);
  }

  const rawResults = await db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      reason: schema.tasks.reason,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
      customer: schema.tasks.customer,
      tags: schema.tasks.tags,
      projectId: schema.tasks.projectId,
      assigneeId: schema.tasks.assigneeId,
      snippet: sql<string>`snippet(Tasks_FTS, -1, '<b>', '</b>', '...', 10)`,
      score: sql<number>`bm25(Tasks_FTS)`,
    })
    .from(schema.tasksFts)
    .innerJoin(schema.tasks, eq(schema.tasksFts.taskId, schema.tasks.id))
    .where(and(...conditions))
    .orderBy(sql`bm25(Tasks_FTS)`)
    .limit(30);

  const names = await getUserNames(
    db,
    rawResults.map((r) => r.assigneeId)
  );
  return (rawResults || []).map((r: any) => ({
    id: r.id,
    shortId: r.id.slice(0, 8),
    title: r.title,
    reason: r.reason,
    status: r.status,
    priority: Number(r.priority || 5),
    customer: r.customer,
    tags: r.tags,
    snippet: r.snippet,
    score: Number(r.score || 0),
    projectId: r.projectId,
    projectName: projectsById.get(r.projectId)?.name ?? null,
    orgId: projectsById.get(r.projectId)?.orgId ?? null,
    orgName: projectsById.get(r.projectId)?.orgName ?? null,
    assigneeId: r.assigneeId,
    assigneeName: r.assigneeId ? (names.get(r.assigneeId) ?? null) : null,
  }));
}
