import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env } from '../index';
import * as goalService from '../services/goalService';
import { generatePosterSvg } from '../services/posterSvgService';
import { goalCreateSchema, goalUpdateSchema } from '../validators/goalValidators';

const goalsApp = new Hono<{ Bindings: Env }>();

// GET /api/v2/goals/poster.svg - Dynamic A2 Vector Poster Export
goalsApp.get('/poster.svg', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const userGoals = await goalService.getGoalsForUser(db, userId);

  const aims = userGoals.filter((g) => g.type === 'aim');
  const focuses = userGoals.filter((g) => g.type === 'focus');
  const values = userGoals.filter((g) => g.type === 'value');
  const housekeeping = userGoals.filter((g) => g.type === 'housekeeping');

  const svg = generatePosterSvg({
    aims: aims.map((g) => ({
      id: g.id,
      type: g.type as 'aim',
      title: g.title,
      description: g.description,
      icon: g.icon,
      orderIndex: g.orderIndex,
      isActive: g.isActive,
    })),
    focuses: focuses.map((g) => ({
      id: g.id,
      type: g.type as 'focus',
      title: g.title,
      description: g.description,
      icon: g.icon,
      orderIndex: g.orderIndex,
      isActive: g.isActive,
    })),
    values: values.map((g) => ({
      id: g.id,
      type: g.type as 'value',
      title: g.title,
      description: g.description,
      icon: g.icon,
      orderIndex: g.orderIndex,
      isActive: g.isActive,
    })),
    housekeeping: housekeeping.map((g) => ({
      id: g.id,
      type: g.type as 'housekeeping',
      title: g.title,
      description: g.description,
      icon: g.icon,
      orderIndex: g.orderIndex,
      isActive: g.isActive,
    })),
  });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
});

// GET /api/v2/goals - List user goals (optional ?type= filter)
goalsApp.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const typeParam = c.req.query('type') as 'aim' | 'focus' | 'value' | 'housekeeping' | undefined;

  const goals = await goalService.getGoalsForUser(db, userId, typeParam);
  c.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
  return c.json(goals);
});

// POST /api/v2/goals - Create new goal
goalsApp.post('/', zValidator('json', goalCreateSchema), async (c) => {
  const goalData = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  const newGoal = await goalService.createGoal(db, userId, {
    id: uuidv4(),
    ...goalData,
  });

  return c.json(newGoal, 201);
});

// PUT /api/v2/goals/:id - Update goal
goalsApp.put('/:id', zValidator('json', goalUpdateSchema), async (c) => {
  const goalId = c.req.param('id');
  const goalData = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  const updatedGoal = await goalService.updateGoal(db, userId, goalId, goalData);
  if (!updatedGoal) {
    return c.json({ error: 'Goal not found or access denied' }, 404);
  }

  return c.json(updatedGoal);
});

// DELETE /api/v2/goals/:id - Delete goal
goalsApp.delete('/:id', async (c) => {
  const goalId = c.req.param('id');
  const userId = c.get('userId');
  const db = c.get('db');

  const success = await goalService.deleteGoal(db, userId, goalId);
  if (!success) {
    return c.json({ error: 'Goal not found or access denied' }, 404);
  }

  return c.json({ message: 'Goal deleted successfully' });
});

export default goalsApp;
