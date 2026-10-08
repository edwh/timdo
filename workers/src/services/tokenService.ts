/**
 * Personal access tokens for the CLI and MCP.
 *
 * A token acts only as the person who created it (it can never act as someone else), is shown
 * once at creation, and is stored as a SHA-256 hash. Tokens are created from a signed-in web
 * session, so a leaked token can't mint more tokens.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '../db/schema';

type DB = DrizzleD1Database<typeof schema>;

export const TOKEN_PREFIX = 'tdo_';
const MAX_ACTIVE_TOKENS = 20;
// Only record "last used" this often, to keep D1 writes down
const LAST_USED_GRANULARITY_MS = 60 * 60 * 1000;

export interface TokenSummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export const isPersonalToken = (value: string) => value.startsWith(TOKEN_PREFIX);

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(30));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createToken(db: DB, userId: string, name: string) {
  const active = await listTokens(db, userId);
  if (active.length >= MAX_ACTIVE_TOKENS) {
    throw new Error(`You already have ${MAX_ACTIVE_TOKENS} tokens. Revoke one you no longer use.`);
  }
  const token = `${TOKEN_PREFIX}${randomSecret()}`;
  const row = {
    id: uuidv4(),
    userId,
    name: name.trim(),
    tokenHash: await hashToken(token),
    prefix: token.slice(0, TOKEN_PREFIX.length + 6),
    createdAt: new Date().toISOString(),
  };
  await db.insert(schema.apiTokens).values(row);
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt,
    lastUsedAt: null,
    token,
  };
}

export async function listTokens(db: DB, userId: string): Promise<TokenSummary[]> {
  return db
    .select({
      id: schema.apiTokens.id,
      name: schema.apiTokens.name,
      prefix: schema.apiTokens.prefix,
      createdAt: schema.apiTokens.createdAt,
      lastUsedAt: schema.apiTokens.lastUsedAt,
    })
    .from(schema.apiTokens)
    .where(and(eq(schema.apiTokens.userId, userId), isNull(schema.apiTokens.revokedAt)))
    .orderBy(desc(schema.apiTokens.createdAt));
}

export async function revokeToken(db: DB, userId: string, tokenId: string) {
  const result = await db
    .update(schema.apiTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.apiTokens.id, tokenId),
        eq(schema.apiTokens.userId, userId),
        isNull(schema.apiTokens.revokedAt)
      )
    )
    .returning({ id: schema.apiTokens.id });
  return result.length > 0;
}

/** The user (and token id) a token belongs to, or null if it's unknown or revoked. */
export async function resolveToken(
  db: DB,
  token: string
): Promise<{ userId: string; tokenId: string } | null> {
  if (!isPersonalToken(token)) {
    return null;
  }
  const row = await db
    .select({
      id: schema.apiTokens.id,
      userId: schema.apiTokens.userId,
      lastUsedAt: schema.apiTokens.lastUsedAt,
    })
    .from(schema.apiTokens)
    .where(
      and(
        eq(schema.apiTokens.tokenHash, await hashToken(token)),
        isNull(schema.apiTokens.revokedAt)
      )
    )
    .get();
  if (!row) {
    return null;
  }
  const last = row.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last > LAST_USED_GRANULARITY_MS) {
    try {
      await db
        .update(schema.apiTokens)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(schema.apiTokens.id, row.id));
    } catch (err) {
      console.warn('[tokens] could not record last use', err);
    }
  }
  return { userId: row.userId, tokenId: row.id };
}
