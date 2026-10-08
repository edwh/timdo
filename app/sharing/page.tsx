'use client';

import React from 'react';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CreateWorkspaceModal } from '../../components/Sharing/CreateWorkspaceModal';
import { SignInPrompt } from '../../components/Sharing/SignInPrompt';
import { WorkspaceCard } from '../../components/Sharing/WorkspaceCard';
import { useSharingOverview } from '../hooks/useSharingQueries';

function CardSkeleton() {
  return (
    <Card withBorder radius="md" padding="lg" aria-hidden>
      <Group gap="sm" mb="md" wrap="nowrap">
        <Skeleton height={38} width={38} radius="md" />
        <Box style={{ flex: 1 }}>
          <Skeleton height={18} width="40%" radius="sm" />
          <Skeleton height={10} width="25%" mt={8} radius="sm" />
        </Box>
      </Group>
      <Skeleton height={36} radius="sm" mb="md" />
      {[0, 1].map((i) => (
        <Group key={i} gap="sm" py="xs" wrap="nowrap">
          <Skeleton circle height={38} />
          <Box style={{ flex: 1 }}>
            <Skeleton height={12} width="35%" radius="sm" />
            <Skeleton height={10} width="50%" mt={6} radius="sm" />
          </Box>
          <Skeleton height={26} width={90} radius="sm" />
        </Group>
      ))}
    </Card>
  );
}

export default function SharingPage() {
  const { status } = useSession();
  const { data, isLoading, isError, error, refetch, isFetching } = useSharingOverview();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  if (status === 'unauthenticated') {
    return (
      <Container size="md" py="xl">
        <SignInPrompt title="Sharing" message="Sign in to see who you share your projects with." />
      </Container>
    );
  }

  const workspaces = Array.isArray(data)
    ? [...data].sort((a, b) => Number(b.isPersonal) - Number(a.isPersonal))
    : [];

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" gap="sm">
          <Box style={{ flex: '1 1 280px' }}>
            <Title order={1}>Sharing</Title>
            <Text c="dimmed" size="sm" maw={560}>
              Everyone in a workspace can see all of its projects, epics and tasks. Move a project
              into a shared workspace to share it. Life goals always stay private.
            </Text>
          </Box>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New shared workspace
          </Button>
        </Group>

        {status === 'loading' || isLoading ? (
          <Stack gap="lg" role="status" aria-label="Loading sharing">
            <CardSkeleton />
            <CardSkeleton />
          </Stack>
        ) : isError ? (
          <Alert color="red" variant="light" title="Couldn't load sharing">
            <Text size="sm" mb="xs">
              {(error as Error)?.message || 'Something went wrong.'}
            </Text>
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconRefresh size={14} />}
              onClick={() => refetch()}
              loading={isFetching}
            >
              Try again
            </Button>
          </Alert>
        ) : (
          <Stack gap="lg">
            {workspaces.map((ws) => (
              <WorkspaceCard key={ws.id} workspace={ws} allWorkspaces={workspaces} />
            ))}
          </Stack>
        )}
      </Stack>

      <CreateWorkspaceModal opened={createOpened} onClose={closeCreate} />
    </Container>
  );
}
