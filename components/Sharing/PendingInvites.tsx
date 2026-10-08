'use client';

import React from 'react';
import { IconMailForward, IconX } from '@tabler/icons-react';
import { ActionIcon, Box, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { useRevokeInvite } from '../../app/hooks/useSharingQueries';
import { inviteLink } from '../../app/lib/collaborationApi';
import type { SharingWorkspace } from '../../app/types/collaboration.types';
import { parseTimestamp } from '../Activity/activityFormat';
import { CopyLinkButton } from './CopyLinkButton';
import { RoleBadge } from './PeopleSection';

function expiryText(expiresAt: string): string {
  const date = parseTimestamp(expiresAt);
  if (!date) {
    return '';
  }
  if (date.getTime() < Date.now()) {
    return 'Expired';
  }
  return `Link works until ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)}`;
}

export function PendingInvites({ workspace }: { workspace: SharingWorkspace }) {
  const revoke = useRevokeInvite(workspace.id);
  if (workspace.invites.length === 0) {
    return null;
  }

  return (
    <Box>
      <Text fw={600} size="sm" mb="xs">
        Pending invites
      </Text>
      <Stack gap="xs" component="ul" m={0} p={0} aria-label="Pending invites">
        {workspace.invites.map((invite) => (
          <Group
            component="li"
            key={invite.id}
            wrap="nowrap"
            gap="sm"
            style={{ listStyle: 'none' }}
            data-testid={`invite-row-${invite.id}`}
          >
            <ThemeIcon variant="light" color="orange" radius="xl" size="lg" aria-hidden>
              <IconMailForward size={16} />
            </ThemeIcon>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" truncate>
                {invite.email}
              </Text>
              <Text size="xs" c="dimmed">
                {expiryText(invite.expiresAt)}
              </Text>
            </Box>
            <RoleBadge role={invite.role} size="xs" />
            <CopyLinkButton value={inviteLink(invite.token)} label="Copy invite link" iconOnly />
            <Tooltip label="Cancel invite" withArrow>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Cancel invite for ${invite.email}`}
                loading={revoke.isPending && revoke.variables === invite.id}
                onClick={() => revoke.mutate(invite.id)}
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
      </Stack>
    </Box>
  );
}
