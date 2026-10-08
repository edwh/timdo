import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { Env } from '../index';
import { AccessError } from '../services/accessService';
import * as searchService from '../services/searchService';
import * as taskRelationService from '../services/taskRelationService';
import * as taskService from '../services/taskService';
import {
  taskAssignSchema,
  taskCreateSchema,
  taskGoalLinkSchema,
  taskRelationCreateSchema,
  taskUpdateNoteSchema,
  taskUpdateSchema,
} from '../validators/taskValidators';

const tasksApp = new Hono<{ Bindings: Env }>();

// GET /api/v2/tasks - list tasks with filters
tasksApp.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const orgId = c.req.query('orgId');
  const projectId = c.req.query('projectId');
  const assigneeId = c.req.query('assigneeId');
  const status = c.req.query('status');
  const customer = c.req.query('customer');
  const tag = c.req.query('tag');
  const relatedTo = c.req.query('relatedTo');
  const mineOnly = c.req.query('mine') === 'true';
  const unassignedOnly = c.req.query('unassigned') === 'true';

  const tasks = await taskService.getTasksForUser(db, userId, {
    orgId,
    projectId,
    assigneeId,
    status,
    customer,
    tag,
    relatedTo,
    mineOnly,
    unassignedOnly,
  });

  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
  return c.json(tasks);
});

// GET /api/v2/tasks/search - FTS5 free text search
tasksApp.get('/search', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const query = c.req.query('q') || '';
  const includeDone = c.req.query('includeDone') === 'true';
  const customer = c.req.query('customer');

  const results = await searchService.searchTasksForUser(db, userId, query, includeDone, customer);

  // Enhance results with linked tasks
  const resultsWithLinks = await Promise.all(
    results.map(async (task) => {
      const linkedTasks = await taskRelationService.getTaskRelations(db, task.id, userId);
      return {
        ...task,
        linkedTasks,
      };
    })
  );

  return c.json(resultsWithLinks);
});

// POST /api/v2/tasks - create new task (mandatory projectId)
tasksApp.post('/', zValidator('json', taskCreateSchema), async (c) => {
  const taskData = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const newTask = await taskService.createTask(db, userId, taskData);
    return c.json(newTask, 201);
  } catch (error: any) {
    if (error instanceof AccessError) {
      throw error;
    }
    return c.json({ error: error.message || 'Failed to create task' }, 400);
  }
});

// GET /api/v2/tasks/:id - get single task with relations
tasksApp.get('/:id', async (c) => {
  const taskId = c.req.param('id');
  const userId = c.get('userId');
  const db = c.get('db');

  const task = await taskService.getTaskById(db, userId, taskId);
  if (!task) {
    return c.json({ error: 'Task not found or access denied' }, 404);
  }

  const linkedTasks = await taskRelationService.getTaskRelations(db, task.id, userId);

  return c.json({
    ...task,
    linkedTasks,
  });
});

// PUT /api/v2/tasks/:id - update task
tasksApp.put('/:id', zValidator('json', taskUpdateSchema), async (c) => {
  const taskId = c.req.param('id');
  const taskData = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const updated = await taskService.updateTask(db, userId, taskId, taskData);
    if (!updated) {
      return c.json({ error: 'Task not found or access denied' }, 404);
    }
    return c.json(updated);
  } catch (error: any) {
    if (error instanceof AccessError) {
      throw error;
    }
    return c.json({ error: error.message || 'Failed to update task' }, 400);
  }
});

// POST /api/v2/tasks/:id/claim - current user claims task
tasksApp.post('/:id/claim', async (c) => {
  const taskId = c.req.param('id');
  const userId = c.get('userId');
  const db = c.get('db');

  const updated = await taskService.claimTask(db, userId, taskId);
  if (!updated) {
    return c.json({ error: 'Task not found or access denied' }, 404);
  }

  return c.json(updated);
});

// POST /api/v2/tasks/:id/assign - assign task to user (or null to unassign)
tasksApp.post('/:id/assign', zValidator('json', taskAssignSchema), async (c) => {
  const taskId = c.req.param('id');
  const { assigneeId } = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const updated = await taskService.assignTask(db, userId, taskId, assigneeId);
    if (!updated) {
      return c.json({ error: 'Task not found or access denied' }, 404);
    }
    return c.json(updated);
  } catch (error: any) {
    if (error instanceof AccessError) {
      throw error;
    }
    return c.json({ error: error.message || 'Failed to assign task' }, 400);
  }
});

// GET /api/v2/tasks/:id/updates - get task update notes timeline
tasksApp.get('/:id/updates', async (c) => {
  const taskId = c.req.param('id');
  const userId = c.get('userId');
  const db = c.get('db');

  const updates = await taskService.getTaskUpdates(db, userId, taskId);
  if (!updates) {
    return c.json({ error: 'Task not found or access denied' }, 404);
  }

  return c.json(updates);
});

// POST /api/v2/tasks/:id/updates - add update note to task
tasksApp.post('/:id/updates', zValidator('json', taskUpdateNoteSchema), async (c) => {
  const taskId = c.req.param('id');
  const { note, gmailThreadId } = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  const update = await taskService.addTaskUpdate(db, userId, taskId, note, gmailThreadId);
  if (!update) {
    return c.json({ error: 'Task not found or access denied' }, 404);
  }

  return c.json(update, 201);
});

// GET /api/v2/tasks/:id/goals - get personal life goals linked to task for current user
tasksApp.get('/:id/goals', async (c) => {
  const taskId = c.req.param('id');
  const userId = c.get('userId');
  const db = c.get('db');

  const goals = await taskService.getTaskPersonalGoals(db, userId, taskId);
  if (!goals) {
    return c.json({ error: 'Task not found or access denied' }, 404);
  }

  return c.json(goals);
});

// POST /api/v2/tasks/:id/goals - link personal life goal
tasksApp.post('/:id/goals', zValidator('json', taskGoalLinkSchema), async (c) => {
  const taskId = c.req.param('id');
  const { goalId } = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const linked = await taskService.linkPersonalGoal(db, userId, taskId, goalId);
    if (!linked) {
      return c.json({ error: 'Task not found or access denied' }, 404);
    }
    return c.json(linked, 201);
  } catch (error: any) {
    if (error instanceof AccessError) {
      throw error;
    }
    return c.json({ error: error.message || 'Failed to link goal' }, 400);
  }
});

// DELETE /api/v2/tasks/:id/goals/:goalId - unlink personal life goal
tasksApp.delete('/:id/goals/:goalId', async (c) => {
  const taskId = c.req.param('id');
  const goalId = c.req.param('goalId');
  const userId = c.get('userId');
  const db = c.get('db');

  const unlinked = await taskService.unlinkPersonalGoal(db, userId, taskId, goalId);
  if (!unlinked) {
    return c.json({ error: 'Goal link not found or access denied' }, 404);
  }

  return c.json({ message: 'Goal unlinked successfully' });
});

// POST /api/v2/tasks/:id/links - create or update link to another task
tasksApp.post('/:id/links', zValidator('json', taskRelationCreateSchema), async (c) => {
  const taskId = c.req.param('id');
  const { targetTaskId, relation, reason } = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const link = await taskRelationService.linkTasks(
      db,
      userId,
      taskId,
      targetTaskId,
      relation,
      reason ?? undefined
    );
    return c.json(link, 201);
  } catch (error: any) {
    if (error instanceof AccessError) {
      throw error;
    }
    return c.json({ error: error.message || 'Failed to link tasks' }, 400);
  }
});

// DELETE /api/v2/tasks/:id/links/:targetId - remove link between tasks
tasksApp.delete('/:id/links/:targetId', async (c) => {
  const taskId = c.req.param('id');
  const targetId = c.req.param('targetId');
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const success = await taskRelationService.unlinkTasks(db, userId, taskId, targetId);
    if (!success) {
      return c.json({ error: 'Link not found or access denied' }, 404);
    }
    return c.json({ message: 'Link removed successfully' });
  } catch (error: any) {
    if (error instanceof AccessError) {
      throw error;
    }
    return c.json({ error: error.message || 'Failed to remove link' }, 400);
  }
});

export default tasksApp;
