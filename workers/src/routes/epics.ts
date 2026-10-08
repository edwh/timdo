import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env } from '../index';
import * as epicService from '../services/epicService';
import { epicCreateSchema, epicUpdateSchema } from '../validators/epicValidators';

const epicsApp = new Hono<{ Bindings: Env }>();

// GET /api/v2/epics/:id - One epic with stats, sharing and attribution
epicsApp.get('/:id', async (c) => {
  const epic = await epicService.getEpicForUser(c.get('db'), c.get('userId'), c.req.param('id'));
  if (!epic) {
    return c.json({ error: 'Epic not found or access denied' }, 404);
  }
  return c.json(epic);
});

// GET /api/v2/epics - List epics for user (with task stats and optional ?category= filter)
epicsApp.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const category = c.req.query('category');

  const epics = await epicService.getEpicsForUser(db, userId, category);
  c.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
  return c.json(epics);
});

// POST /api/v2/epics - Create epic
epicsApp.post('/', zValidator('json', epicCreateSchema), async (c) => {
  const epicData = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  const newEpic = await epicService.createEpic(db, userId, {
    id: uuidv4(),
    ...epicData,
  });

  return c.json(newEpic, 201);
});

// PUT /api/v2/epics/:id - Update epic
epicsApp.put('/:id', zValidator('json', epicUpdateSchema), async (c) => {
  const epicId = c.req.param('id');
  const epicData = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  const updatedEpic = await epicService.updateEpic(db, userId, epicId, epicData);
  if (!updatedEpic) {
    return c.json({ error: 'Epic not found or access denied' }, 404);
  }

  return c.json(updatedEpic);
});

// DELETE /api/v2/epics/:id - Delete epic
epicsApp.delete('/:id', async (c) => {
  const epicId = c.req.param('id');
  const userId = c.get('userId');
  const db = c.get('db');

  const success = await epicService.deleteEpic(db, userId, epicId);
  if (!success) {
    return c.json({ error: 'Epic not found or access denied' }, 404);
  }

  return c.json({ message: 'Epic deleted successfully' });
});

export default epicsApp;
