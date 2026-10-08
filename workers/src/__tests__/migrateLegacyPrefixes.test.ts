import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractPrefixAndCleanTitle,
  migrateLegacyPrefixesForUser,
} from '../scripts/migrateLegacyPrefixes';
import { parsePosterGoals, seedGoalsForUser } from '../scripts/seedGoalsFromPoster';

describe('Legacy Prefix Migrator', () => {
  describe('extractPrefixAndCleanTitle', () => {
    it('cleans Solfit prefix and extracts category', () => {
      const res = extractPrefixAndCleanTitle('Solfit: Draft design system mockups');
      expect(res).toEqual({ category: 'Solfit', cleanTitle: 'Draft design system mockups' });
    });

    it('maps MD prefix to Migrating Dragons', () => {
      const res = extractPrefixAndCleanTitle('MD: Fix database index');
      expect(res).toEqual({ category: 'Migrating Dragons', cleanTitle: 'Fix database index' });
    });

    it('cleans Crew: prefix', () => {
      const res = extractPrefixAndCleanTitle('Crew: Plan trip');
      expect(res).toEqual({ category: 'Crew', cleanTitle: 'Plan trip' });
    });

    it('cleans Personal: prefix', () => {
      const res = extractPrefixAndCleanTitle('Personal: Renew gym');
      expect(res).toEqual({ category: 'Personal', cleanTitle: 'Renew gym' });
    });

    it('cleans Mavala: prefix', () => {
      const res = extractPrefixAndCleanTitle('Mavala: Send proposal');
      expect(res).toEqual({ category: 'Mavala', cleanTitle: 'Send proposal' });
    });

    it('cleans Xebit: prefix', () => {
      const res = extractPrefixAndCleanTitle('Xebit: Update docs');
      expect(res).toEqual({ category: 'Xebit', cleanTitle: 'Update docs' });
    });

    it('handles case-insensitive prefix matching', () => {
      const res = extractPrefixAndCleanTitle('solfit: check stats');
      expect(res).toEqual({ category: 'Solfit', cleanTitle: 'check stats' });

      const res2 = extractPrefixAndCleanTitle('md: check logs');
      expect(res2).toEqual({ category: 'Migrating Dragons', cleanTitle: 'check logs' });
    });

    it('leaves uncategorized tasks intact', () => {
      const res = extractPrefixAndCleanTitle('Buy milk');
      expect(res).toEqual({ category: null, cleanTitle: 'Buy milk' });
    });

    it('handles whitespace around colon', () => {
      const res = extractPrefixAndCleanTitle('Solfit : Test something');
      expect(res).toEqual({ category: 'Solfit', cleanTitle: 'Test something' });
    });
  });

  describe('migrateLegacyPrefixesForUser in DB', () => {
    it('migrates tasks with matching prefixes and skips already categorized tasks', async () => {
      const projectsStore = [
        { id: 'p1', userId: 'user-1', project: 'Solfit: Draft mockups', category: null },
        { id: 'p2', userId: 'user-1', project: 'MD: Fix database', category: null },
        { id: 'p3', userId: 'user-1', project: 'Buy groceries', category: null },
      ];

      const db: any = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() =>
              projectsStore.filter((p) => p.userId === 'user-1' && p.category === null)
            ),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn((val: any) => ({
            where: vi.fn((condition: any) => {
              // update matching item in projectsStore
              return [];
            }),
          })),
        })),
      };

      const result = await migrateLegacyPrefixesForUser(db, 'user-1');
      expect(result.migratedCount).toBe(2);
      expect(db.update).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Goals Seeder', () => {
  it('parses poster goals data correctly', () => {
    const goals = parsePosterGoals();
    expect(goals.aims.length).toBe(3);
    expect(goals.focuses.length).toBe(4);
    expect(goals.values.length).toBe(6);
    expect(goals.housekeeping.length).toBe(6);

    expect(goals.aims[0].title).toBe('Look after the people who matter');
    expect(goals.aims[0].icon).toBe('❤️');

    expect(goals.aims[1].title).toBe('Build something worthwhile');
    expect(goals.aims[1].icon).toBe('🚀');

    expect(goals.aims[2].title).toBe('Find moments of adventure');
    expect(goals.aims[2].icon).toBe('🏔️');
  });

  it('seeds default goals into DB for user idempotently', async () => {
    const goalsStore: any[] = [];
    const db: any = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => goalsStore.filter((g) => g.userId === 'user-1')),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((val: any) => {
          goalsStore.push(val);
          return Promise.resolve();
        }),
      })),
    };

    const res1 = await seedGoalsForUser(db, 'user-1');
    expect(res1.seededCount).toBe(19);
    expect(goalsStore.length).toBe(19);

    // Second run should be idempotent (skip existing)
    const res2 = await seedGoalsForUser(db, 'user-1');
    expect(res2.seededCount).toBe(0);
    expect(goalsStore.length).toBe(19);
  });
});
