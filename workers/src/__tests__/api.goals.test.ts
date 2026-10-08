import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import goalsApp from '../routes/goals';
import * as goalService from '../services/goalService';

vi.mock('../services/goalService');

describe('Goals API Routes', () => {
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
    app.route('/api/v2/goals', goalsApp);
  });

  describe('GET /api/v2/goals', () => {
    it('returns goals list for user', async () => {
      const mockGoals = [
        {
          id: 'goal-1',
          userId: 'test-user-id',
          type: 'aim',
          title: 'Family & Loved Ones',
          orderIndex: 0,
          isActive: true,
        },
      ];
      vi.mocked(goalService.getGoalsForUser).mockResolvedValueOnce(mockGoals as any);

      const res = await app.request('/api/v2/goals');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockGoals);
      expect(goalService.getGoalsForUser).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        undefined
      );
    });

    it('passes type filter query param', async () => {
      vi.mocked(goalService.getGoalsForUser).mockResolvedValueOnce([]);

      const res = await app.request('/api/v2/goals?type=focus');
      expect(res.status).toBe(200);
      expect(goalService.getGoalsForUser).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'focus'
      );
    });
  });

  describe('GET /api/v2/goals/poster.svg', () => {
    it('returns dynamic SVG with image/svg+xml content-type', async () => {
      const mockGoals = [
        {
          id: 'aim-1',
          userId: 'test-user-id',
          type: 'aim',
          title: 'Family Goal',
          icon: '👨‍👩‍👦',
          orderIndex: 0,
          isActive: true,
        },
      ];
      vi.mocked(goalService.getGoalsForUser).mockResolvedValueOnce(mockGoals as any);

      const res = await app.request('/api/v2/goals/poster.svg');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
      const svgText = await res.text();
      expect(svgText).toContain('Family Goal');
      expect(svgText).toContain('viewBox="0 0 420 594"');
    });
  });

  describe('POST /api/v2/goals', () => {
    it('creates goal and returns 201', async () => {
      const newGoal = {
        id: 'new-id',
        userId: 'test-user-id',
        type: 'focus' as const,
        title: 'Learn Rust',
        orderIndex: 1,
        isActive: true,
      };
      vi.mocked(goalService.createGoal).mockResolvedValueOnce(newGoal as any);

      const res = await app.request('/api/v2/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'focus',
          title: 'Learn Rust',
          orderIndex: 1,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toEqual(newGoal);
      expect(goalService.createGoal).toHaveBeenCalled();
    });

    it('returns 400 when validation fails', async () => {
      const res = await app.request('/api/v2/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invalid_type',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/v2/goals/:id', () => {
    it('updates goal and returns updated record', async () => {
      const updated = {
        id: 'goal-1',
        userId: 'test-user-id',
        type: 'focus' as const,
        title: 'Master Rust',
        orderIndex: 1,
        isActive: true,
      };
      vi.mocked(goalService.updateGoal).mockResolvedValueOnce(updated as any);

      const res = await app.request('/api/v2/goals/goal-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Master Rust',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(updated);
      expect(goalService.updateGoal).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'goal-1',
        { title: 'Master Rust' }
      );
    });

    it('returns 404 if goal not found', async () => {
      vi.mocked(goalService.updateGoal).mockResolvedValueOnce(null as any);

      const res = await app.request('/api/v2/goals/non-existent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Master Rust',
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v2/goals/:id', () => {
    it('deletes goal and returns success message', async () => {
      vi.mocked(goalService.deleteGoal).mockResolvedValueOnce(true);

      const res = await app.request('/api/v2/goals/goal-1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ message: 'Goal deleted successfully' });
      expect(goalService.deleteGoal).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'goal-1'
      );
    });

    it('returns 404 if goal to delete was not found', async () => {
      vi.mocked(goalService.deleteGoal).mockResolvedValueOnce(false);

      const res = await app.request('/api/v2/goals/non-existent', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
    });
  });
});
