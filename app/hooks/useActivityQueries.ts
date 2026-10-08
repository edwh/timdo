import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { fetchActivity } from '../lib/collaborationApi';
import type { ActivityFilters } from '../types/collaboration.types';

/** Query keys for the activity log. Invalidate `activityKeys.all` after anything that logs. */
export const activityKeys = {
  all: ['activity'] as const,
  list: (filters: ActivityFilters) =>
    [
      ...activityKeys.all,
      {
        taskId: filters.taskId ?? null,
        epicId: filters.epicId ?? null,
        projectId: filters.projectId ?? null,
        orgId: filters.orgId ?? null,
        limit: filters.limit ?? null,
      },
    ] as const,
};

/**
 * Who did what, newest first, filtered by task, epic, project or workspace.
 * Keeps the previous page on screen while a bigger `limit` loads, so "Load more" doesn't flash.
 */
export function useActivity(filters: ActivityFilters, options: { enabled?: boolean } = {}) {
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useQuery({
    queryKey: activityKeys.list(filters),
    queryFn: () => fetchActivity(filters, token),
    enabled: !!token && (options.enabled ?? true),
    staleTime: 30 * 1000,
    // Only keep the old list on screen when just the limit grew, not when the filters changed
    placeholderData: (previous, previousQuery) => {
      const prevFilters = previousQuery?.queryKey?.[1] as Record<string, unknown> | undefined;
      const nextFilters = activityKeys.list(filters)[1];
      const sameFilters =
        !!prevFilters &&
        prevFilters.taskId === nextFilters.taskId &&
        prevFilters.epicId === nextFilters.epicId &&
        prevFilters.projectId === nextFilters.projectId &&
        prevFilters.orgId === nextFilters.orgId;
      return sameFilters ? keepPreviousData(previous) : undefined;
    },
  });
}
