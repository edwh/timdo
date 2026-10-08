import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import {
  generateProjectKey,
  generateSlug,
  runMultiUserMigration,
} from '../services/migrationService';

describe('runMultiUserMigration helper functions', () => {
  it('generates proper project keys', () => {
    expect(generateProjectKey('Solfit')).toBe('SOL');
    expect(generateProjectKey('Crew')).toBe('CRE');
    expect(generateProjectKey('Mavala Tech')).toBe('MTX');
  });

  it('generates slug from organisation name', () => {
    expect(generateSlug('Tim Dobson')).toBe('tim-dobson');
    expect(generateSlug('XEBIT Ltd')).toBe('xebit-ltd');
  });
});

describe('runMultiUserMigration', () => {
  it('creates default user organisation and migrates legacy categories to projects', async () => {
    const orgsStore: any[] = [];
    const membersStore: any[] = [];
    const projectsStore: any[] = [];
    const tasksStore: any[] = [];
    const taskGoalsStore: any[] = [];

    const mockLegacyProjects = [
      {
        id: 'task-1',
        userId: 'user-1',
        project: 'Implement multi-user schema',
        reason: 'Colleague collaboration',
        status: 'do',
        priority: 8,
        size: '***',
        notes: 'Important note',
        statusLastChangedOn: null,
        awaitUntil: null,
        gmailThreadId: 'thread-123',
        category: 'Solfit',
        epicId: null,
        goalId: 'goal-1',
        isDeleted: false,
      },
      {
        id: 'task-2',
        userId: 'user-1',
        project: 'Crew Committee Report',
        reason: 'AGM',
        status: 'do',
        priority: 5,
        size: '**',
        notes: null,
        statusLastChangedOn: null,
        awaitUntil: null,
        gmailThreadId: null,
        category: 'Crew',
        epicId: null,
        goalId: null,
        isDeleted: false,
      },
    ];

    const mockDb: any = {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => ({
          where: vi.fn(() => ({
            get: vi.fn(async () => null),
            all: vi.fn(async () => mockLegacyProjects),
          })),
          all: vi.fn(async () => []),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn(async (vals: any) => {
          if (vals.slug) orgsStore.push(vals);
          else if (vals.role) membersStore.push(vals);
          else if (vals.key) projectsStore.push(vals);
          else if (vals.title) tasksStore.push(vals);
          else if (vals.goalId) taskGoalsStore.push(vals);
          return { success: true };
        }),
      })),
    };

    const result = await runMultiUserMigration(mockDb, 'user-1');

    expect(result).toBeDefined();
    expect(result.organisation).toBeDefined();
    expect(result.organisation.name).toBe('Personal Workspace');
    expect(result.migratedProjectsCount).toBe(2); // 'Solfit' and 'Crew'
    expect(result.migratedTasksCount).toBe(2);
    expect(orgsStore.length).toBe(1);
    expect(membersStore.length).toBe(1);
    expect(projectsStore.length).toBe(2);
    expect(tasksStore.length).toBe(2);
    expect(taskGoalsStore.length).toBe(1);

    // Verify task attributes preserved
    const task1 = tasksStore.find((t) => t.id === 'task-1');
    expect(task1).toBeDefined();
    expect(task1.title).toBe('Implement multi-user schema');
    expect(task1.reason).toBe('Colleague collaboration');
    expect(task1.gmailThreadId).toBe('thread-123');
    expect(task1.assigneeId).toBe('user-1');
    expect(task1.reporterId).toBe('user-1');
  });

  it('is idempotent when re-run for same user', async () => {
    const existingOrg = {
      id: 'org-123',
      name: 'Tim Dobson',
      slug: 'tim-dobson',
      createdBy: 'user-1',
    };
    const existingMember = {
      id: 'mem-123',
      orgId: 'org-123',
      userId: 'user-1',
      role: 'owner',
    };

    const mockDb: any = {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => ({
          where: vi.fn(() => ({
            get: vi.fn(async () => {
              if (table === schema.organisations) {
                return existingOrg;
              }
              return existingMember;
            }),
            all: vi.fn(async () => []),
          })),
          all: vi.fn(async () => []),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => ({ success: true })),
      })),
    };

    const result = await runMultiUserMigration(mockDb, 'user-1');
    expect(result.organisation.id).toBe('org-123');
    expect(result.migratedProjectsCount).toBe(1); // 'General' fallback created if empty
    expect(result.migratedTasksCount).toBe(0);
  });
});
