'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Alert, Button, Container, Skeleton, Stack, Text, Title } from '@mantine/core';
import { TaskDetailView } from '../../../components/TaskDetail/TaskDetailView';
import { useProject } from '../../hooks/useProjectQueries';

export const runtime = 'edge';

function TaskDetailSkeleton() {
  return (
    <Container size="md" py="xl">
      <Stack gap="lg" role="status" aria-label="Loading task details">
        <Skeleton height={28} width={140} radius="sm" />
        <Skeleton height={18} width="60%" radius="sm" />
        <Skeleton height={420} radius="md" />
      </Stack>
    </Container>
  );
}

export default function TaskDetailPage() {
  const params = useParams();
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const { status } = useSession();

  const { data: task, isLoading, isError, error } = useProject(id);

  if (status === 'loading' || isLoading) {
    return <TaskDetailSkeleton />;
  }

  if (isError) {
    return (
      <Container size="md" py="xl">
        <Stack align="flex-start" gap="md">
          <Alert title="Couldn't load this task" color="red" w="100%">
            {error?.message || 'Could not load task details.'}
          </Alert>
          <Button component={Link} href="/board" variant="light">
            Back to Board
          </Button>
        </Stack>
      </Container>
    );
  }

  if (!task) {
    return (
      <Container size="md" py="xl">
        <Stack align="flex-start" gap="md">
          <Title order={2}>Task Not Found</Title>
          <Text c="dimmed">
            This task doesn&apos;t exist, has been deleted, or isn&apos;t shared with you.
          </Text>
          <Button component={Link} href="/board" variant="light">
            Back to Board
          </Button>
        </Stack>
      </Container>
    );
  }

  // Keyed by id so moving between tasks resets the editable fields
  return <TaskDetailView key={task.id} task={task} />;
}
