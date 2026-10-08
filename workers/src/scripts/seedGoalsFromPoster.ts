import { and, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '../db/schema';

type DB = DrizzleD1Database<typeof schema>;

export interface PosterGoalDefinition {
  type: 'aim' | 'focus' | 'value' | 'housekeeping';
  title: string;
  description?: string | null;
  icon?: string | null;
  orderIndex: number;
}

export function parsePosterGoals(): {
  aims: PosterGoalDefinition[];
  focuses: PosterGoalDefinition[];
  values: PosterGoalDefinition[];
  housekeeping: PosterGoalDefinition[];
} {
  // Example starter goals in the poster's shape (3 aims, 4 focuses, 6 values, 6 rhythm boxes).
  // Generic on purpose: real goals live in each user's own Goals rows.
  const aims: PosterGoalDefinition[] = [
    { type: 'aim', title: 'Look after the people who matter', icon: '❤️', orderIndex: 0 },
    { type: 'aim', title: 'Build something worthwhile', icon: '🚀', orderIndex: 1 },
    { type: 'aim', title: 'Find moments of adventure', icon: '🏔️', orderIndex: 2 },
  ];

  const focuses: PosterGoalDefinition[] = [
    { type: 'focus', title: 'Get fitter', icon: '🏃', orderIndex: 0 },
    { type: 'focus', title: 'Learn a new skill', icon: '📚', orderIndex: 1 },
    { type: 'focus', title: 'Ship the side project', icon: '💻', orderIndex: 2 },
    { type: 'focus', title: 'Help my community', icon: '🤝', orderIndex: 3 },
  ];

  const values: PosterGoalDefinition[] = [
    {
      type: 'value',
      title: '1) Optimism',
      description: 'Expect things to work out, and face facts.',
      orderIndex: 0,
    },
    {
      type: 'value',
      title: '2) Growth',
      description: 'Keep learning and reflect regularly.',
      orderIndex: 1,
    },
    {
      type: 'value',
      title: '3) Clear Communication',
      description: 'Seek understanding first.',
      orderIndex: 2,
    },
    {
      type: 'value',
      title: '4) Humility',
      description: 'Stay approachable and grateful.',
      orderIndex: 3,
    },
    {
      type: 'value',
      title: '5) Generosity',
      description: 'Leave people better off.',
      orderIndex: 4,
    },
    {
      type: 'value',
      title: '6) Hard Work',
      description: 'Plan, execute, reflect, repeat.',
      orderIndex: 5,
    },
  ];

  const housekeeping: PosterGoalDefinition[] = [
    {
      type: 'housekeeping',
      title: 'Weekly',
      description: '▸ Food shop\n▸ Bins out',
      orderIndex: 0,
    },
    {
      type: 'housekeeping',
      title: 'Monthly',
      description: '▸ Pay the bills\n▸ Plan the month',
      orderIndex: 1,
    },
    {
      type: 'housekeeping',
      title: 'Every Few Months',
      description: '▸ Meter readings',
      orderIndex: 2,
    },
    { type: 'housekeeping', title: 'Daily Personal', description: '▸ Exercise', orderIndex: 3 },
    {
      type: 'housekeeping',
      title: 'Daily Shared',
      description: '▸ Cook\n▸ Tidy up',
      orderIndex: 4,
    },
    { type: 'housekeeping', title: 'Child Care', description: '▸ School run', orderIndex: 5 },
  ];

  return { aims, focuses, values, housekeeping };
}

/**
 * Seeds default goals for a given user from poster definition.
 * Idempotent: Skips goals with titles that already exist for the user.
 */
export async function seedGoalsForUser(db: DB, userId: string): Promise<{ seededCount: number }> {
  const { aims, focuses, values, housekeeping } = parsePosterGoals();
  const allGoals = [...aims, ...focuses, ...values, ...housekeeping];

  const existingGoals = await db.select().from(schema.goals).where(eq(schema.goals.userId, userId));

  const existingTitles = new Set(existingGoals.map((g) => g.title.toLowerCase()));

  let seededCount = 0;

  for (const goal of allGoals) {
    if (!existingTitles.has(goal.title.toLowerCase())) {
      await db.insert(schema.goals).values({
        id: uuidv4(),
        userId,
        type: goal.type,
        title: goal.title,
        description: goal.description ?? null,
        icon: goal.icon ?? null,
        orderIndex: goal.orderIndex,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      seededCount++;
    }
  }

  return { seededCount };
}
