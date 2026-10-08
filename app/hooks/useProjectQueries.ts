import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { getProjectById, getProjects, isAccessError } from '../lib/apiClient';

/**
 * Query keys for tasks. The list lives at `['projects']` (shared with the board and every page
 * that loads all visible tasks); a single task lives under `['projects', 'detail', id]`, so
 * invalidating `['projects']` refreshes both.
 */
export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
};

/** Every task I can see, across all my workspaces. */
export function useProjects() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: projectKeys.all,
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return getProjects(session.accessToken);
    },
    enabled: !!session?.accessToken,
  });
}

/** One task via `GET /projects/:id`. Resolves to null when it's missing or not visible. */
export function useProject(id: string | null | undefined) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: projectKeys.detail(id || ''),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return getProjectById(id as string, session.accessToken);
    },
    enabled: !!session?.accessToken && !!id,
    // "Not allowed" won't change on a retry, so show it straight away
    retry: (failureCount, error) => !isAccessError(error) && failureCount < 2,
  });
}
