import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import * as schema from '../db/schema';
import type { Env } from '../index';
import { combinedAuthMiddleware, internalAuthMiddleware } from '../middleware/auth';
import { ensureUser } from '../services/userService';
import { userCreateSchema } from '../validators/userValidators';

const userApp = new Hono<{ Bindings: Env }>();

// This endpoint is protected by a shared secret, as it's called server-to-server from Next.js.
userApp.post('/ensure', internalAuthMiddleware, zValidator('json', userCreateSchema), async (c) => {
  const userData = c.req.valid('json');
  const db = c.get('db');
  const user = await ensureUser(db, userData);
  return c.json(user);
});

// The signed-in user, so clients can tell "me" from collaborators
userApp.get('/me', combinedAuthMiddleware, async (c) => {
  const db = c.get('db');
  const user = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, c.get('userId')))
    .get();
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }
  c.header('Cache-Control', 'private, max-age=300');
  return c.json(user);
});

export default userApp;
