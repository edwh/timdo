import { describe, expect, it, vi } from 'vitest';
import { getTaskRelations, linkTasks, unlinkTasks } from '../services/taskRelationService';

describe('taskRelationService', () => {
  it('throws when linking task to itself', async () => {
    const mockDb: any = {};
    // Mock resolveTaskIdForUser returning same ID
    vi.mock('../services/taskService', () => ({
      resolveTaskIdForUser: vi.fn().mockResolvedValue('task-123'),
      getUserAccessibleProjectIds: vi.fn().mockResolvedValue(['proj-1']),
    }));

    await expect(linkTasks(mockDb, 'user-1', 'task-123', 'task-123', 'relates_to')).rejects.toThrow(
      'Cannot link a task to itself'
    );
  });
});
