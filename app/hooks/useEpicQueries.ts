import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import {
  createEpic,
  deleteEpic,
  getEpicById,
  getEpics,
  isAccessError,
  updateEpic,
} from '../lib/apiClient';
import type { Epic, EpicCreateInput, EpicUpdateInput } from '../types/epic.types';

// Query key factory
export const epicKeys = {
  all: ['epics'] as const,
  lists: () => [...epicKeys.all, 'list'] as const,
  list: (category?: string) => [...epicKeys.lists(), { category }] as const,
  detail: (id: string) => [...epicKeys.all, 'detail', id] as const,
};

/**
 * One epic via `GET /epics/:id`. Resolves to null when it's missing or not visible.
 */
export function useEpic(id: string | null | undefined) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: epicKeys.detail(id || ''),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return getEpicById(id as string, session.accessToken);
    },
    enabled: !!session?.accessToken && !!id,
    // "Not allowed" won't change on a retry, so show it straight away
    retry: (failureCount, error) => !isAccessError(error) && failureCount < 2,
  });
}

/**
 * Fetch all epics for current user (optional category filter)
 */
export function useEpics(category?: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: epicKeys.list(category),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return getEpics(category, session.accessToken);
    },
    enabled: !!session?.accessToken,
  });
}

/**
 * Mutation hook to create a new epic
 */
export function useCreateEpic() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (newEpic: EpicCreateInput) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return createEpic(newEpic, session.accessToken);
    },
    onSuccess: (createdEpic) => {
      queryClient.invalidateQueries({ queryKey: epicKeys.all });
      notifications.show({
        title: 'Epic Created',
        message: `Successfully created "${createdEpic.title}"`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create epic',
        color: 'red',
      });
    },
  });
}

/**
 * Mutation hook to update an epic
 */
export function useUpdateEpic() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (variables: { epicId: string; data: EpicUpdateInput }) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return updateEpic(variables.epicId, variables.data, session.accessToken);
    },
    onMutate: async ({ epicId, data }) => {
      await queryClient.cancelQueries({ queryKey: epicKeys.all });
      const previousEpics = queryClient.getQueryData<Epic[]>(epicKeys.list());

      if (previousEpics) {
        queryClient.setQueryData<Epic[]>(
          epicKeys.list(),
          previousEpics.map((e) => (e.id === epicId ? { ...e, ...data } : e))
        );
      }

      return { previousEpics };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousEpics) {
        queryClient.setQueryData(epicKeys.list(), context.previousEpics);
      }
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update epic',
        color: 'red',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: epicKeys.all });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
    onSuccess: (updatedEpic) => {
      notifications.show({
        title: 'Epic Updated',
        message: `Successfully updated "${updatedEpic.title}"`,
        color: 'green',
      });
    },
  });
}

/**
 * Mutation hook to delete an epic
 */
export function useDeleteEpic() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (epicId: string) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return deleteEpic(epicId, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: epicKeys.all });
      notifications.show({
        title: 'Epic Deleted',
        message: 'Epic was successfully deleted',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete epic',
        color: 'red',
      });
    },
  });
}
