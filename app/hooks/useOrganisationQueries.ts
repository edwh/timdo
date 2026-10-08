import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import {
  createOrganisation,
  fetchOrganisation,
  fetchOrganisationInvites,
  fetchOrganisationMembers,
  fetchOrganisations,
  inviteUser,
  removeMember,
  searchUsers,
  updateMemberRole,
} from '../lib/apiClient';
import type { InviteMemberInput, OrganisationCreateInput } from '../types/organisation.types';

// Query keys
export const organisationKeys = {
  all: ['organisations'] as const,
  lists: () => [...organisationKeys.all, 'list'] as const,
  detail: (id: string) => [...organisationKeys.all, 'detail', id] as const,
  members: (id: string) => [...organisationKeys.all, 'members', id] as const,
  invites: (id: string) => [...organisationKeys.all, 'invites', id] as const,
  userSearch: (id: string, query: string) =>
    [...organisationKeys.all, 'search', id, query] as const,
};

/**
 * Fetch all organisations for current user
 */
export function useOrganisations() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: organisationKeys.lists(),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return fetchOrganisations(session.accessToken);
    },
    enabled: !!session?.accessToken,
  });
}

/**
 * Fetch single organisation details
 */
export function useOrganisation(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: organisationKeys.detail(id),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return fetchOrganisation(id, session.accessToken);
    },
    enabled: !!session?.accessToken && !!id,
  });
}

/**
 * Fetch members of an organisation
 */
export function useOrganisationMembers(orgId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: organisationKeys.members(orgId),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return fetchOrganisationMembers(orgId, session.accessToken);
    },
    enabled: !!session?.accessToken && !!orgId,
  });
}

/**
 * Fetch pending invites of an organisation
 */
export function useOrganisationInvites(orgId: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: organisationKeys.invites(orgId),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return fetchOrganisationInvites(orgId, session.accessToken);
    },
    enabled: !!session?.accessToken && !!orgId,
  });
}

/**
 * Search users for autocomplete
 */
export function useSearchUsers(orgId: string, query: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: organisationKeys.userSearch(orgId, query),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return searchUsers(orgId, query, session.accessToken);
    },
    enabled: !!session?.accessToken && !!orgId && query.trim().length > 0,
  });
}

/**
 * Create a new organisation
 */
export function useCreateOrganisation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (data: OrganisationCreateInput) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return createOrganisation(data, session.accessToken);
    },
    onSuccess: (newOrg) => {
      queryClient.invalidateQueries({ queryKey: organisationKeys.all });
      notifications.show({
        title: 'Organisation Created',
        message: `Successfully created "${newOrg.name}"`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create organisation',
        color: 'red',
      });
    },
  });
}

/**
 * Invite a member to organisation
 */
export function useInviteMember(orgId: string) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (data: InviteMemberInput) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return inviteUser(orgId, data, session.accessToken);
    },
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: organisationKeys.invites(orgId) });
      notifications.show({
        title: 'Invitation Sent',
        message: `Invitation sent to ${invite.email}`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Invite Failed',
        message: error.message || 'Failed to send invitation',
        color: 'red',
      });
    },
  });
}

/**
 * Update member role
 */
export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' }) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return updateMemberRole(orgId, userId, role, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organisationKeys.members(orgId) });
      notifications.show({
        title: 'Role Updated',
        message: 'Member role updated successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Update Failed',
        message: error.message || 'Failed to update member role',
        color: 'red',
      });
    },
  });
}

/**
 * Remove member
 */
export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (userId: string) => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return removeMember(orgId, userId, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organisationKeys.members(orgId) });
      notifications.show({
        title: 'Member Removed',
        message: 'Member removed successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Removal Failed',
        message: error.message || 'Failed to remove member',
        color: 'red',
      });
    },
  });
}
