import { and, asc, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '../db/schema';
import type {
  GoalCreateInput,
  GoalCreatePayload,
  GoalUpdatePayload,
} from '../validators/goalValidators';

type DB = DrizzleD1Database<typeof schema>;

export async function getGoalsForUser(
  db: DB,
  userId: string,
  type?: 'aim' | 'focus' | 'value' | 'housekeeping'
) {
  const conditions = [eq(schema.goals.userId, userId), eq(schema.goals.isActive, true)];

  if (type) {
    conditions.push(eq(schema.goals.type, type));
  }

  return db
    .select()
    .from(schema.goals)
    .where(and(...conditions))
    .orderBy(asc(schema.goals.orderIndex), asc(schema.goals.createdAt));
}

export async function createGoal(
  db: DB,
  userId: string,
  data: (GoalCreateInput | GoalCreatePayload) & { id?: string }
) {
  const newGoalData = {
    id: data.id ?? uuidv4(),
    userId,
    type: data.type,
    title: data.title,
    description: data.description ?? null,
    icon: data.icon ?? null,
    orderIndex: data.orderIndex ?? 0,
    isActive: data.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result = await db.insert(schema.goals).values(newGoalData).returning();
  return result[0];
}

export async function updateGoal(db: DB, userId: string, goalId: string, data: GoalUpdatePayload) {
  const updatedData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  const result = await db
    .update(schema.goals)
    .set(updatedData)
    .where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, userId)))
    .returning();

  return result[0] ?? null;
}

export async function deleteGoal(db: DB, userId: string, goalId: string) {
  const result = await db
    .delete(schema.goals)
    .where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, userId)))
    .returning({ id: schema.goals.id });

  return result.length > 0;
}
