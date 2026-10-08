import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import { apiFetch, readApiError } from '../lib/apiClient';
import { getWorkerApiBaseUrl } from '../lib/apiConfig';

/** A personal access token as listed by the API. The secret itself is never listed. */
export interface ApiToken {
  id: string;
  name: string;
  /** First few characters of the token, e.g. "tdo_Ab12Cd" */
  prefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

/** Returned once, straight after creating a token. `token` is the full secret. */
export interface CreatedApiToken extends ApiToken {
  token: string;
}

export const apiTokenKeys = {
  all: ['users', 'me', 'tokens'] as const,
};

function tokensUrl(id?: string): string {
  const base = `${getWorkerApiBaseUrl()}/users/me/tokens`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

function headers(accessToken?: string, json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) {
    h['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    h.Authorization = `Bearer ${accessToken}`;
  }
  return h;
}

export async function fetchApiTokens(accessToken?: string): Promise<ApiToken[]> {
  const response = await apiFetch(tokensUrl(), { headers: headers(accessToken) });
  if (!response.ok) {
    throw await readApiError(response, "Couldn't load your tokens");
  }
  return response.json();
}

export async function createApiToken(name: string, accessToken?: string): Promise<CreatedApiToken> {
  const response = await apiFetch(tokensUrl(), {
    method: 'POST',
    headers: headers(accessToken, true),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw await readApiError(response, "Couldn't create the token");
  }
  return response.json();
}

export async function revokeApiToken(id: string, accessToken?: string): Promise<void> {
  const response = await apiFetch(tokensUrl(id), {
    method: 'DELETE',
    headers: headers(accessToken),
  });
  if (!response.ok) {
    throw await readApiError(response, "Couldn't revoke the token");
  }
}

function useAccessToken() {
  const { data: session } = useSession();
  return session?.accessToken;
}

function showError(title: string) {
  return (error: Error) => {
    notifications.show({
      title,
      message: error.message || 'Something went wrong. Please try again.',
      color: 'red',
    });
  };
}

/** Your active tokens, newest first. */
export function useApiTokens() {
  const accessToken = useAccessToken();
  return useQuery({
    queryKey: apiTokenKeys.all,
    queryFn: () => fetchApiTokens(accessToken),
    enabled: !!accessToken,
    staleTime: 30 * 1000,
  });
}

/**
 * Create a token. The caller shows the secret once from the result. gcTime 0 and the caller's
 * reset() drop it from the mutation cache straight away; only the summary is cached.
 */
export function useCreateApiToken() {
  const queryClient = useQueryClient();
  const accessToken = useAccessToken();
  return useMutation({
    mutationFn: (name: string) => createApiToken(name.trim(), accessToken),
    gcTime: 0,
    onSuccess: (created) => {
      const summary: ApiToken = {
        id: created.id,
        name: created.name,
        prefix: created.prefix,
        createdAt: created.createdAt,
        lastUsedAt: created.lastUsedAt,
      };
      queryClient.setQueryData<ApiToken[]>(apiTokenKeys.all, (old) =>
        old ? [summary, ...old.filter((t) => t.id !== summary.id)] : old
      );
      queryClient.invalidateQueries({ queryKey: apiTokenKeys.all });
    },
    onError: showError("Couldn't create the token"),
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  const accessToken = useAccessToken();
  return useMutation({
    mutationFn: ({ id }: { id: string; name?: string }) => revokeApiToken(id, accessToken),
    onSuccess: (_data, { id, name }) => {
      queryClient.setQueryData<ApiToken[]>(apiTokenKeys.all, (old) =>
        old ? old.filter((t) => t.id !== id) : old
      );
      queryClient.invalidateQueries({ queryKey: apiTokenKeys.all });
      notifications.show({
        message: name ? `Revoked "${name}". It no longer works.` : 'Token revoked',
        color: 'green',
      });
    },
    onError: showError("Couldn't revoke the token"),
  });
}
