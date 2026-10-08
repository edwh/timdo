import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { getUserAccessibleProjectIds } from './taskService';

type DB = DrizzleD1Database<typeof schema>;

export interface CustomerSummary {
  customer: string;
  openCount: number;
}

export async function getCustomersForUser(db: DB, userId: string): Promise<CustomerSummary[]> {
  const accessibleProjectIds = await getUserAccessibleProjectIds(db, userId);

  const taskCondition = and(
    inArray(schema.tasks.projectId, accessibleProjectIds),
    sql`${schema.tasks.customer} is not null and ${schema.tasks.customer} != ''`,
    eq(schema.tasks.isDeleted, false)
  );

  if (accessibleProjectIds.length === 0) {
    return [];
  }
  const taskResults = await db
    .select({
      customer: schema.tasks.customer,
      openCount:
        sql<number>`count(case when ${schema.tasks.status} != 'done' then 1 else null end)`.as(
          'open_count'
        ),
    })
    .from(schema.tasks)
    .where(taskCondition)
    .groupBy(schema.tasks.customer);

  const map = new Map<string, number>();
  for (const r of taskResults) {
    if (r.customer && r.customer.trim().length > 0) {
      const key = r.customer.trim();
      map.set(key, (map.get(key) || 0) + Number(r.openCount || 0));
    }
  }

  return Array.from(map.entries())
    .map(([customer, openCount]) => ({ customer, openCount }))
    .sort((a, b) => a.customer.localeCompare(b.customer));
}
