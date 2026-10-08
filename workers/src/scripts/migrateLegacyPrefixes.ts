import { and, eq, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type DB = DrizzleD1Database<typeof schema>;

export const PREFIX_CATEGORY_MAP: Record<string, string> = {
  solfit: 'Solfit',
  crew: 'Crew',
  personal: 'Personal',
  mavala: 'Mavala',
  md: 'Migrating Dragons',
  xebit: 'Xebit',
};

const PREFIX_REGEX = /^(Solfit|Crew|Personal|Mavala|MD|Xebit)\s*:\s*(.*)$/i;

/**
 * Extracts category from title prefix if present and returns cleaned title.
 * Returns { category, cleanTitle }
 */
export function extractPrefixAndCleanTitle(title: string): {
  category: string | null;
  cleanTitle: string;
} {
  const match = title.match(PREFIX_REGEX);
  if (!match) {
    return { category: null, cleanTitle: title };
  }

  const rawPrefix = match[1].toLowerCase();
  const category = PREFIX_CATEGORY_MAP[rawPrefix] || match[1];
  const cleanTitle = match[2].trim();

  return { category, cleanTitle };
}

/**
 * Migrates legacy prefixes in task titles for a given user.
 * Skips tasks that already have a category set.
 */
export async function migrateLegacyPrefixesForUser(
  db: DB,
  userId: string
): Promise<{ migratedCount: number }> {
  // Query tasks for the user where category is null or empty
  const userProjects = await db
    .select()
    .from(schema.legacyProjects)
    .where(and(eq(schema.legacyProjects.userId, userId), isNull(schema.legacyProjects.category)));

  let migratedCount = 0;

  for (const project of userProjects) {
    const { category, cleanTitle } = extractPrefixAndCleanTitle(project.project);
    if (category) {
      await db
        .update(schema.legacyProjects)
        .set({
          project: cleanTitle,
          category,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.legacyProjects.id, project.id));
      migratedCount++;
    }
  }

  return { migratedCount };
}
