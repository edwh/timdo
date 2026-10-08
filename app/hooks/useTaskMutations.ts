import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import { assignTask, fetchTasks, linkTaskGoal, type TaskFiltersClient } from '../lib/apiClient';
import type { Project } from '../types/project.types';
import { useCurrentUser } from './useCurrentUser';
import { projectKeys } from './useProjectQueries';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters?: TaskFiltersClient) => [...taskKeys.lists(), filters ?? {}] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};

/**
 * Fetch tasks query
 */
export function useTasks(filters?: TaskFiltersClient) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return fetchTasks(filters, session.accessToken);
    },
    enabled: !!session?.accessToken,
  });
}

type Snapshot = Array<[readonly unknown[], unknown]>;

/**
 * Optimistically set a task's assignee in the task list, the single-task cache and the
 * collaborative task lists. Returns a snapshot for rollback.
 */
async function applyAssignee(
  queryClient: QueryClient,
  taskId: string,
  patch: Pick<Project, 'assigneeId' | 'assigneeName' | 'isMine'>
): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: projectKeys.all });
  await queryClient.cancelQueries({ queryKey: taskKeys.all });
  const snapshot: Snapshot = [
    ...queryClient.getQueriesData({ queryKey: projectKeys.all }),
    ...queryClient.getQueriesData({ queryKey: taskKeys.all }),
  ];

  const patchOne = (task: Project) => (task.id === taskId ? { ...task, ...patch } : task);
  const patchAny = (old: unknown) => {
    if (Array.isArray(old)) {
      return (old as Project[]).map(patchOne);
    }
    if (old && typeof old === 'object' && (old as Project).id === taskId) {
      return patchOne(old as Project);
    }
    return old;
  };
  queryClient.setQueriesData({ queryKey: projectKeys.all }, patchAny);
  queryClient.setQueriesData({ queryKey: taskKeys.all }, patchAny);
  return snapshot;
}

function rollback(queryClient: QueryClient, snapshot?: Snapshot) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

function settle(queryClient: QueryClient, updated?: Project) {
  if (updated) {
    queryClient.setQueryData(projectKeys.detail(updated.id), updated);
  }
  queryClient.invalidateQueries({ queryKey: projectKeys.all });
  queryClient.invalidateQueries({ queryKey: taskKeys.all });
  queryClient.invalidateQueries({ queryKey: ['activity'] });
}

/**
 * 1-click "Assign to me" with a snappy optimistic update
 */
export function useClaimTask() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: (taskId: string) => {
      if (!session?.accessToken || !user?.id) {
        throw new Error('Not authenticated');
      }
      return assignTask(taskId, user.id, session.accessToken);
    },
    onMutate: async (taskId: string) => {
      const snapshot = await applyAssignee(queryClient, taskId, {
        assigneeId: user?.id ?? null,
        assigneeName: user?.name || 'You',
        isMine: true,
      });
      return { snapshot };
    },
    onError: (err, _taskId, context) => {
      rollback(queryClient, context?.snapshot);
      notifications.show({
        title: 'Could not assign',
        message: err.message || 'Could not assign the task to you',
        color: 'red',
      });
    },
    onSuccess: (updatedTask) => {
      settle(queryClient, updatedTask);
      notifications.show({
        title: 'Assigned to you',
        message: `"${updatedTask.title || updatedTask.project || 'Task'}" is now yours`,
        color: 'green',
      });
    },
  });
}

/**
 * Assign a task to a workspace member (or null to unassign), with an optimistic update.
 * Pass `assigneeName` so cards update straight away.
 */
export function useAssignTask() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { userId } = useCurrentUser();

  return useMutation({
    mutationFn: ({
      taskId,
      assigneeId,
    }: {
      taskId: string;
      assigneeId: string | null;
      assigneeName?: string | null;
    }) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return assignTask(taskId, assigneeId, session.accessToken);
    },
    onMutate: async ({ taskId, assigneeId, assigneeName }) => {
      const snapshot = await applyAssignee(queryClient, taskId, {
        assigneeId,
        assigneeName: assigneeId ? (assigneeName ?? null) : null,
        isMine: !!assigneeId && assigneeId === userId,
      });
      return { snapshot };
    },
    onError: (err, _variables, context) => {
      rollback(queryClient, context?.snapshot);
      notifications.show({
        title: 'Could not reassign',
        message: err.message || 'Failed to reassign task',
        color: 'red',
      });
    },
    onSuccess: (updatedTask) => {
      settle(queryClient, updatedTask);
      notifications.show({
        title: 'Assignee updated',
        message: updatedTask.assigneeId
          ? `"${updatedTask.project}" is assigned to ${
              updatedTask.assigneeId === userId ? 'you' : updatedTask.assigneeName || 'them'
            }`
          : `"${updatedTask.project}" is now unassigned`,
        color: 'green',
      });
    },
  });
}

/**
 * Link Task to Personal Goal Mutation
 */
export function useLinkTaskGoal() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: ({ taskId, goalId }: { taskId: string; goalId: string }) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return linkTaskGoal(taskId, goalId, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      notifications.show({
        title: 'Goal Linked',
        message: 'Personal life goal successfully linked to task',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Link Failed',
        message: err.message || 'Failed to link personal goal',
        color: 'red',
      });
    },
  });
}
