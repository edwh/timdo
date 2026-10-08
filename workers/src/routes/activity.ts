import { Hono } from 'hono';
import type { Env } from '../index';
import { getActivity } from '../services/activityService';

const activityApp = new Hono<{ Bindings: Env }>();

// GET /api/v2/activity?taskId=&epicId=&projectId=&orgId=&limit= - Who did what, newest first
activityApp.get('/', async (c) => {
  const limit = Number(c.req.query('limit') || 100);
  const entries = await getActivity(c.get('db'), c.get('userId'), {
    taskId: c.req.query('taskId') || undefined,
    epicId: c.req.query('epicId') || undefined,
    projectId: c.req.query('projectId') || undefined,
    orgId: c.req.query('orgId') || undefined,
    limit: Number.isFinite(limit) ? limit : 100,
  });
  c.header('Cache-Control', 'private, max-age=15');
  return c.json(entries);
});

export default activityApp;
