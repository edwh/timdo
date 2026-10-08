'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Alert, Button, Container, Skeleton, Stack, Text, Title } from '@mantine/core';
import { EpicDetailView } from '../../../components/EpicDetail/EpicDetailView';
import { useEpic } from '../../hooks/useEpicQueries';
import { useGoals } from '../../hooks/useGoalQueries';
import { useProjects } from '../../hooks/useProjectQueries';

export const runtime = 'edge';

function EpicDetailSkeleton() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg" role="status" aria-label="Loading epic details">
        <Skeleton height={28} width={120} radius="sm" />
        <Skeleton height={180} radius="md" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={56} radius="sm" />
        ))}
      </Stack>
    </Container>
  );
}

export default function EpicDetailPage() {
  const params = useParams();
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const { status } = useSession();

  const {
    data: epic,
    isLoading: isEpicLoading,
    isError: isEpicError,
    error: epicError,
  } = useEpic(id);
  const {
    data: projects,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    error: projectsError,
  } = useProjects();
  // Life goals are private; an epic's goal only comes back for its creator
  const { data: goals } = useGoals();

  if (status === 'loading' || isEpicLoading || isProjectsLoading) {
    return <EpicDetailSkeleton />;
  }

  if (isEpicError || isProjectsError) {
    return (
      <Container size="lg" py="xl">
        <Stack align="flex-start" gap="md">
          <Alert title="Couldn't load this epic" color="red" w="100%">
            {epicError?.message || projectsError?.message || 'Could not load epic.'}
          </Alert>
          <Button component={Link} href="/epics" variant="light">
            All Epics
          </Button>
        </Stack>
      </Container>
    );
  }

  if (!epic) {
    return (
      <Container size="lg" py="xl">
        <Stack align="flex-start" gap="md">
          <Title order={2}>Epic Not Found</Title>
          <Text c="dimmed">
            This epic doesn&apos;t exist, has been deleted, or isn&apos;t shared with you.
          </Text>
          <Button component={Link} href="/epics" variant="light">
            All Epics
          </Button>
        </Stack>
      </Container>
    );
  }

  return <EpicDetailView key={epic.id} epic={epic} tasks={projects || []} goals={goals || []} />;
}
