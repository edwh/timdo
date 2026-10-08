import type { Context, Next } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../index';
import { isPersonalToken, resolveToken } from '../services/tokenService';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  console.log(`[Auth Middleware] Triggered for ${c.req.method} ${c.req.path}`);

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth Middleware] Failed: Missing or invalid Authorization header');
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      },
      401
    );
  }

  const token = authHeader.substring(7);
  if (!token) {
    console.log('[Auth Middleware] Failed: Missing token');
    return c.json({ error: 'Unauthorized', message: 'Missing token' }, 401);
  }

  const JWKS = createRemoteJWKSet(new URL(`https://${c.env.AUTH0_DOMAIN}/.well-known/jwks.json`));

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${c.env.AUTH0_DOMAIN}/`,
      audience: c.env.AUTH0_AUDIENCE,
    });

    if (!payload.sub) {
      console.log('[Auth Middleware] Failed: Token missing subject (sub) claim');
      return c.json({ error: 'Unauthorized', message: 'Token missing subject (sub) claim' }, 401);
    }

    console.log(`[Auth Middleware] Success: User ID ${payload.sub}`);
    c.set('userId', payload.sub);
    await next();
  } catch (err) {
    let errorMessage = 'Token validation failed';
    if (err instanceof Error) {
      errorMessage = `Token validation failed: ${err.message}`;
      // The 'jose' library errors have a 'code' property, but it's not on the standard Error type.
      // We can check for it as an unknown property.
      if ('code' in err) {
        const joseError = err as {
          code: string;
          claim?: string;
          reason?: string;
        };
        if (joseError.code === 'ERR_JWKS_TIMEOUT') {
          errorMessage = 'JWKS endpoint timed out. Cannot verify token.';
        } else if (joseError.code === 'ERR_JWS_INVALID') {
          errorMessage = 'JWS is invalid. Token malformed or signature invalid.';
        } else if (joseError.code === 'ERR_JWT_EXPIRED') {
          errorMessage = 'Token has expired.';
        } else if (joseError.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
          errorMessage = `Token claim validation failed: ${joseError.claim} ${joseError.reason}.`;
        }
      }
    }
    console.error('[Auth Middleware] Failed: Token validation error', {
      errorMessage,
      error: err,
    });
    return c.json({ error: 'Unauthorized', message: errorMessage }, 401);
  }
}

export async function internalAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const internalSecret = c.req.header('X-Internal-Secret');
  // Fail closed if the secret isn't configured (undefined === undefined would let anyone in)
  if (!c.env.INTERNAL_API_SECRET || internalSecret !== c.env.INTERNAL_API_SECRET) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
}

/**
 * CLI/MCP personal access token: acts only as its owner, never as anyone else.
 */
async function personalTokenAuth(c: Context<{ Bindings: Env }>, next: Next, token: string) {
  const db = c.get('db');
  const resolved = await resolveToken(db, token);
  if (!resolved) {
    return c.json({ error: 'This token is invalid or has been revoked' }, 401);
  }
  const { userId } = resolved;
  const asEmail = c.req.header('X-Timdo-User')?.trim().toLowerCase();
  if (asEmail) {
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    const me = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (me?.email.toLowerCase() !== asEmail) {
      return c.json({ error: 'A personal token can only act as its owner' }, 403);
    }
  }
  c.set('userId', userId);
  c.set('authMethod', 'token');
  c.set('tokenId', resolved.tokenId);
  return next();
}

export async function combinedAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const internalSecret = c.req.header('X-Internal-Secret');

  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.substring(7).trim();
    if (isPersonalToken(bearer)) {
      return personalTokenAuth(c, next, bearer);
    }
    if (c.req.header('X-Timdo-User')) {
      return c.json({ error: 'Acting as another user needs the owner secret' }, 403);
    }
    c.set('authMethod', 'jwt');
    return authMiddleware(c, next);
  }

  if (internalSecret) {
    if (!c.env.INTERNAL_API_SECRET || internalSecret !== c.env.INTERNAL_API_SECRET) {
      return c.json({ error: 'Forbidden', message: 'Invalid internal secret' }, 403);
    }

    // The CLI and MCP act as the account owner (the first user to sign up) unless
    // X-Timdo-User names another account by email.
    const db = c.get('db');
    const { users } = await import('../db/schema');
    const { asc, eq } = await import('drizzle-orm');
    const asEmail = c.req.header('X-Timdo-User')?.trim().toLowerCase();
    const user = asEmail
      ? await db.select({ id: users.id }).from(users).where(eq(users.email, asEmail)).get()
      : await db.select({ id: users.id }).from(users).orderBy(asc(users.createdAt)).limit(1).get();

    if (!user) {
      return c.json({ error: asEmail ? `No user with email ${asEmail}` : 'No user found' }, 404);
    }

    c.set('userId', user.id);
    c.set('authMethod', 'internal');
    return next();
  }

  return c.json(
    { error: 'Unauthorized', message: 'Missing Authorization or X-Internal-Secret header' },
    401
  );
}
