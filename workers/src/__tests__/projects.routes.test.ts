import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import projectsApp from '../routes/projects';
import * as projectService from '../services/projectService';

vi.mock('../services/projectService');

describe('Projects API Routes', () => {
  let app: Hono<any>;
  const testUserId = 'test-user-id';
  const targetId = '11111111-1111-4111-8111-111111111111';
  const sourceId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    // Simulate auth & db middleware
    app.use('*', async (c, next) => {
      c.set('userId', testUserId);
      c.set('db', {} as any);
      await next();
    });
    app.route('/api/v2/projects', projectsApp);
  });

  describe('POST /api/v2/projects/:id/merge', () => {
    it('returns 200 with merged project on valid request', async () => {
      const mockMergedProject = {
        id: targetId,
        userId: testUserId,
        project: 'Target task',
        priority: 9,
        size: '****',
        notes: 'Merged notes',
      };
      vi.mocked(projectService.mergeProjects).mockResolvedValueOnce(mockMergedProject as any);

      const res = await app.request(`/api/v2/projects/${targetId}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockMergedProject);
      expect(projectService.mergeProjects).toHaveBeenCalledWith(
        expect.anything(),
        testUserId,
        targetId,
        sourceId
      );
    });

    it('returns 400 when sourceId is not a valid UUID', async () => {
      const res = await app.request(`/api/v2/projects/${targetId}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceId: 'not-a-uuid' }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 when sourceId matches targetId', async () => {
      const res = await app.request(`/api/v2/projects/${targetId}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceId: targetId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: 'Cannot merge a task into itself' });
      expect(projectService.mergeProjects).not.toHaveBeenCalled();
    });

    it('returns 404 if projectService.mergeProjects returns null', async () => {
      vi.mocked(projectService.mergeProjects).mockResolvedValueOnce(null);

      const res = await app.request(`/api/v2/projects/${targetId}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceId }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ error: 'One or both tasks not found or access denied' });
    });
  });
});
