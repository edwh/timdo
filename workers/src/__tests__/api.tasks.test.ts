import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import tasksApp from '../routes/tasks';
import * as taskService from '../services/taskService';

vi.mock('../services/taskService');

describe('Tasks API Routes', () => {
  let app: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    // Simulate auth & db middleware
    app.use('*', async (c, next) => {
      c.set('userId', 'test-user-id');
      c.set('db', {} as any);
      await next();
    });
    app.route('/api/v2/tasks', tasksApp);
  });

  describe('GET /api/v2/tasks', () => {
    it('returns filtered tasks list for user', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          projectId: 'project-1',
          title: 'Implement multi-tenant schema',
          status: 'do',
          priority: 8,
          size: '***',
          assigneeId: 'test-user-id',
        },
      ];
      vi.mocked(taskService.getTasksForUser).mockResolvedValueOnce(mockTasks as any);

      const res = await app.request('/api/v2/tasks?mine=true&status=do');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockTasks);
      expect(taskService.getTasksForUser).toHaveBeenCalledWith(expect.anything(), 'test-user-id', {
        orgId: undefined,
        projectId: undefined,
        assigneeId: undefined,
        status: 'do',
        mineOnly: true,
        unassignedOnly: false,
      });
    });
  });

  describe('POST /api/v2/tasks', () => {
    it('creates task with mandatory projectId', async () => {
      const newTask = {
        id: 'task-new-1',
        projectId: 'project-123',
        title: 'Review auth scopes',
        status: 'do',
        priority: 7,
        size: '**',
        reporterId: 'test-user-id',
      };
      vi.mocked(taskService.createTask).mockResolvedValueOnce(newTask as any);

      const res = await app.request('/api/v2/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          title: 'Review auth scopes',
          priority: 7,
          size: '**',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toEqual(newTask);
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        expect.objectContaining({
          projectId: 'project-123',
          title: 'Review auth scopes',
          priority: 7,
          size: '**',
        })
      );
    });

    it('rejects task creation when projectId is missing', async () => {
      const res = await app.request('/api/v2/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Missing project task',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v2/tasks/:id/claim', () => {
    it('claims task for authenticated user', async () => {
      const claimedTask = {
        id: 'task-1',
        projectId: 'proj-1',
        title: 'Claimable task',
        assigneeId: 'test-user-id',
      };
      vi.mocked(taskService.claimTask).mockResolvedValueOnce(claimedTask as any);

      const res = await app.request('/api/v2/tasks/task-1/claim', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(claimedTask);
      expect(taskService.claimTask).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'task-1'
      );
    });
  });

  describe('POST /api/v2/tasks/:id/assign', () => {
    it('assigns task to another user', async () => {
      const reassignedTask = {
        id: 'task-1',
        projectId: 'proj-1',
        title: 'Reassigned task',
        assigneeId: 'user-sarah',
      };
      vi.mocked(taskService.assignTask).mockResolvedValueOnce(reassignedTask as any);

      const res = await app.request('/api/v2/tasks/task-1/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeId: 'user-sarah',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(reassignedTask);
      expect(taskService.assignTask).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'task-1',
        'user-sarah'
      );
    });
  });

  describe('POST /api/v2/tasks/:id/updates', () => {
    it('adds timeline update note', async () => {
      const updateNote = {
        id: 'note-1',
        taskId: 'task-1',
        authorId: 'test-user-id',
        note: 'Deployed to staging worker',
        gmailThreadId: 'thread-xyz',
      };
      vi.mocked(taskService.addTaskUpdate).mockResolvedValueOnce(updateNote as any);

      const res = await app.request('/api/v2/tasks/task-1/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: 'Deployed to staging worker',
          gmailThreadId: 'thread-xyz',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toEqual(updateNote);
      expect(taskService.addTaskUpdate).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'task-1',
        'Deployed to staging worker',
        'thread-xyz'
      );
    });
  });

  describe('POST /api/v2/tasks/:id/goals', () => {
    it('links personal life goal to collaborative task', async () => {
      const goalLink = {
        taskId: 'task-1',
        userId: 'test-user-id',
        goalId: 'goal-health',
      };
      vi.mocked(taskService.linkPersonalGoal).mockResolvedValueOnce(goalLink as any);

      const res = await app.request('/api/v2/tasks/task-1/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: 'goal-health',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toEqual(goalLink);
      expect(taskService.linkPersonalGoal).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'task-1',
        'goal-health'
      );
    });
  });
});
