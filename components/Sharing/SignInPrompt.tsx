'use client';

import React from 'react';
import { IconLogin } from '@tabler/icons-react';
import { signIn } from 'next-auth/react';
import { Button, Card, Stack, Text, Title } from '@mantine/core';

/** Shown when a page needs a signed-in user. Sends them back here afterwards. */
export function SignInPrompt({ title, message }: { title: string; message: string }) {
  return (
    <Card withBorder radius="md" padding="xl" maw={480} mx="auto">
      <Stack align="center" gap="sm" ta="center">
        <Title order={2} size="h3">
          {title}
        </Title>
        <Text c="dimmed" size="sm">
          {message}
        </Text>
        <Button
          leftSection={<IconLogin size={16} />}
          onClick={() =>
            signIn('auth0', {
              callbackUrl: typeof window !== 'undefined' ? window.location.href : '/',
            })
          }
        >
          Sign in
        </Button>
      </Stack>
    </Card>
  );
}
