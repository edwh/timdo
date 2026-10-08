'use client';

import React, { useState } from 'react';
import { IconKey, IconTrash } from '@tabler/icons-react';
import { Box, Button, Code, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { useRevokeApiToken, type ApiToken } from '../../app/hooks/useApiTokens';
import { absoluteTime, parseTimestamp, relativeTime } from '../Activity/activityFormat';
import { ConfirmModal } from '../Sharing/ConfirmModal';

function When({ value, fallback }: { value: string | null; fallback: string }) {
  const date = parseTimestamp(value);
  if (!date) {
    return <>{fallback}</>;
  }
  return (
    <Tooltip label={absoluteTime(date)} withArrow openDelay={200}>
      <Text span size="xs" c="dimmed" style={{ cursor: 'default' }}>
        <time dateTime={date.toISOString()}>{relativeTime(date)}</time>
      </Text>
    </Tooltip>
  );
}

export function TokenList({ tokens }: { tokens: ApiToken[] }) {
  const revoke = useRevokeApiToken();
  const [confirming, setConfirming] = useState<ApiToken | null>(null);

  if (tokens.length === 0) {
    return (
      <Text size="sm" c="dimmed" data-testid="tokens-empty">
        No tokens yet. Create one below to get started.
      </Text>
    );
  }

  return (
    <>
      <Stack gap="sm" component="ul" m={0} p={0} aria-label="Your tokens">
        {tokens.map((token) => (
          <Group
            component="li"
            key={token.id}
            gap="sm"
            wrap="nowrap"
            align="center"
            style={{ listStyle: 'none' }}
            data-testid={`token-row-${token.id}`}
          >
            <ThemeIcon variant="light" radius="xl" size="lg" aria-hidden>
              <IconKey size={16} />
            </ThemeIcon>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
                  {token.name}
                </Text>
                <Code>{token.prefix}&hellip;</Code>
              </Group>
              <Text size="xs" c="dimmed">
                Created <When value={token.createdAt} fallback="unknown" />
                {' · '}
                Last used <When value={token.lastUsedAt} fallback="Never" />
              </Text>
            </Box>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={14} />}
              aria-label={`Revoke ${token.name}`}
              onClick={() => setConfirming(token)}
              style={{ flexShrink: 0 }}
            >
              Revoke
            </Button>
          </Group>
        ))}
      </Stack>

      <ConfirmModal
        opened={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) {
            revoke.mutate(
              { id: confirming.id, name: confirming.name },
              { onSettled: () => setConfirming(null) }
            );
          }
        }}
        title={confirming ? `Revoke "${confirming.name}"?` : 'Revoke token?'}
        confirmLabel="Revoke token"
        danger
        loading={revoke.isPending}
      >
        <Text size="sm">Anything using this token will stop working straight away.</Text>
      </ConfirmModal>
    </>
  );
}
