import NextAuth from 'next-auth';
import Auth0 from 'next-auth/providers/auth0';

// Helper function to check for required environment variables
function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Please check your .env.local file.`
    );
  }
  return value;
}

// Runtime validation for environment variables
const auth0ClientId = getRequiredEnvVar('AUTH0_CLIENT_ID');
const auth0ClientSecret = getRequiredEnvVar('AUTH0_CLIENT_SECRET');
let auth0Issuer = getRequiredEnvVar('AUTH0_ISSUER');
const auth0Audience = getRequiredEnvVar('AUTH0_AUDIENCE');
const workerApiUrl = getRequiredEnvVar('NEXT_PUBLIC_WORKER_API_BASE_URL');

// Make the secret optional in development, but required in production.
const internalApiSecret =
  process.env.NODE_ENV === 'production'
    ? getRequiredEnvVar('INTERNAL_API_SECRET')
    : process.env.INTERNAL_API_SECRET;

if (!auth0Issuer.startsWith('https://')) {
  auth0Issuer = `https://${auth0Issuer}`;
}

async function ensureUserInD1(userData: {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}) {
  // If the secret is missing in a non-production environment, log a warning and skip the call.
  if (!internalApiSecret) {
    // biome-ignore lint/suspicious/noConsoleLog: This is a deliberate developer warning for a misconfigured environment.
    console.log(
      'WARN: INTERNAL_API_SECRET is not set. Skipping user provisioning in D1. This is acceptable for local development but will fail in production.'
    );
    return;
  }

  const url = `${workerApiUrl}/users/ensure`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': internalApiSecret,
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to ensure user in D1: ${response.status} ${errorBody}`);
  }
  return response.json();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Auth0({
      clientId: auth0ClientId,
      clientSecret: auth0ClientSecret,
      issuer: auth0Issuer,
      authorization: {
        params: {
          scope: 'openid email profile',
          audience: auth0Audience,
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        if (!account.access_token) {
          throw new Error('Auth0 did not return an access token.');
        }
        // Use providerAccountId (Auth0's sub claim) instead of user.id
        const auth0UserId = account.providerAccountId || user.id;
        if (!auth0UserId) {
          throw new Error('Auth0 user payload missing id.');
        }
        token.accessToken = account.access_token as string;
        token.id = auth0UserId;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.accessToken || !token.id) {
        throw new Error('Session callback invoked without token details.');
      }
      session.accessToken = token.accessToken as string;
      session.user.id = token.id as string;
      return session;
    },
    async signIn({ user, account, profile }) {
      // biome-ignore lint/suspicious/noConsoleLog: Debug user ID mismatch
      console.log('[signIn] Auth0 user object:', {
        userId: user.id,
        userEmail: user.email,
        accountSub: account?.providerAccountId,
      });

      if (!user.id || !user.email) {
        // biome-ignore lint/suspicious/noConsoleLog: Critical auth error logging
        console.log('ERROR: Auth0 user missing required fields', {
          id: user.id,
          email: user.email,
        });
        return false;
      }

      // Use account.providerAccountId (Auth0's sub claim) instead of user.id
      const auth0UserId = account?.providerAccountId || user.id;
      // biome-ignore lint/suspicious/noConsoleLog: Debug user ID mismatch
      console.log('[signIn] Using user ID:', auth0UserId);

      try {
        await ensureUserInD1({
          id: auth0UserId,
          email: user.email,
          name: user.name || undefined,
          // Auth0 says whether the address is verified; only then are pending invites claimed
          emailVerified: profile?.email_verified === true,
        });
        return true;
      } catch (error) {
        // biome-ignore lint/suspicious/noConsoleLog: Critical auth error logging
        console.error('ERROR: Failed to provision user during sign-in in D1.', {
          userId: auth0UserId,
          error: error instanceof Error ? error.message : String(error),
        });
        // If user provisioning fails (e.g. temporary D1 limit/network blip), still allow login
        // for users authenticated by Auth0 so they aren't locked out of the app.
        return true;
      }
    },
  },
});
