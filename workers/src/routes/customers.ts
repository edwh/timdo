import { Hono } from 'hono';
import type { Env } from '../index';
import * as customerService from '../services/customerService';

const customersApp = new Hono<{ Bindings: Env }>();

// GET /api/v2/customers - list all distinct active customers with open counts
customersApp.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const customers = await customerService.getCustomersForUser(db, userId);

  c.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
  return c.json(customers);
});

export default customersApp;
