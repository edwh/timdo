'use client';

import React from 'react';
import { IconAlertTriangle, IconKey } from '@tabler/icons-react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import type { CreatedApiToken } from '../../app/hooks/useApiTokens';
import { CopyLinkButton } from '../Sharing/CopyLinkButton';
import { CommandBlock } from './CommandBlock';

/** Log in by pasting at the prompt, so the token never lands in shell history. */
export const LOGIN_COMMAND = 'bin/timdo login';

/** Shows a freshly created token once, and how to log the CLI in with it. */
export function NewTokenPanel({
  created,
  onDismiss,
}: {
  created: CreatedApiToken;
  onDismiss: () => void;
}) {
  return (
    <Alert
      variant="light"
      color="teal"
      radius="md"
      icon={<IconKey size={20} />}
      title={`Your new token: ${created.name}`}
      data-testid="new-token-panel"
      aria-live="polite"
    >
      <Stack gap="sm">
        <Group gap={6} wrap="nowrap" align="flex-start">
          <IconAlertTriangle
            size={16}
            color="var(--mantine-color-orange-filled)"
            style={{ flexShrink: 0, marginTop: 2 }}
            aria-hidden
          />
          <Text size="sm" fw={600}>
            Copy it now. You won&apos;t be able to see it again.
          </Text>
        </Group>
        <CommandBlock value={created.token} testId="new-token-value" withCopy={false} />
        <Group>
          <CopyLinkButton value={created.token} label="Copy token" />
        </Group>
        <Text size="sm">
          Then, from the timdo folder, run this and paste the token when it asks. Pasting at the
          prompt keeps the token out of your shell history.
        </Text>
        <CommandBlock
          value={LOGIN_COMMAND}
          copyLabel="Copy login command"
          testId="new-token-login-command"
        />
        <Group justify="flex-end">
          <Button size="xs" variant="default" onClick={onDismiss}>
            Dismiss
          </Button>
        </Group>
      </Stack>
    </Alert>
  );
}
