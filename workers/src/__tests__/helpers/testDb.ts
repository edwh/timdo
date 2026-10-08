/**
 * Real-SQL test database: node:sqlite in memory, loaded with the live D1 schema
 * (fixtures/live-schema.sql) plus pending migrations, wrapped in drizzle's sqlite-proxy
 * so services run their actual queries.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../../db/schema';

// Vite doesn't know node:sqlite yet, so load it through Node's own require.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DatabaseSync } = createRequire(__filename)('node:sqlite') as { DatabaseSync: any };
type DatabaseSync = any;

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'live-schema.sql');
const MIGRATIONS = path.join(__dirname, '..', '..', '..', 'migrations');
const PENDING_MIGRATIONS = ['0006_collaboration.sql'];

export const TIM = 'user-tim';
export const ROBIN = 'user-robin';
export const STRANGER = 'user-stranger';

export function createTestDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  raw.exec(fs.readFileSync(FIXTURE, 'utf8'));
  for (const file of PENDING_MIGRATIONS) {
    raw.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }

  const db = drizzle(
    async (query, params, method) => {
      const stmt = raw.prepare(query);
      const args = (params as any[]).map((p) => (typeof p === 'boolean' ? Number(p) : p));
      if (method === 'run') {
        stmt.run(...args);
        return { rows: [] };
      }
      // Positional rows: joins return duplicate column names that objects would collapse
      stmt.setReturnArrays(true);
      if (method === 'get') {
        return { rows: stmt.get(...args) } as any;
      }
      return { rows: stmt.all(...args) };
    },
    { schema }
  );

  return { db: db as any, raw };
}

/** Tim owns a personal workspace and a shared one; Robin is a member of the shared one. */
export function seedCollaboration(raw: DatabaseSync) {
  raw.exec(`
    INSERT INTO Users (id, email, name) VALUES
      ('${TIM}', 'tim@example.com', 'Tim Dobson'),
      ('${ROBIN}', 'robin@example.com', 'Robin Fairweather'),
      ('${STRANGER}', 'stranger@example.com', 'Stranger');
    INSERT INTO Organisations (id, name, slug, created_by, is_personal) VALUES
      ('org-tim', 'Tim Dobson', 'tim', '${TIM}', 1),
      ('org-md', 'Migrating Dragons', 'migrating-dragons', '${TIM}', 0),
      ('org-stranger', 'Stranger', 'stranger', '${STRANGER}', 1);
    INSERT INTO OrganisationMembers (id, org_id, user_id, role) VALUES
      ('m1', 'org-tim', '${TIM}', 'owner'),
      ('m2', 'org-md', '${TIM}', 'owner'),
      ('m3', 'org-md', '${ROBIN}', 'member'),
      ('m4', 'org-stranger', '${STRANGER}', 'owner');
    INSERT INTO Projects (id, org_id, key, name) VALUES
      ('proj-personal', 'org-tim', 'PER', 'Personal'),
      ('proj-solfit', 'org-md', 'SOL', 'Solfit'),
      ('proj-md', 'org-md', 'MIG', 'Migrating Dragons'),
      ('proj-stranger', 'org-stranger', 'STR', 'Stranger Things');
  `);
}
