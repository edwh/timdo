'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Alert, Button, Container, Skeleton, Stack, Text, Title } from '@mantine/core';
import { CategoryDetailView } from '../../../components/CategoryDetail/CategoryDetailView';
import { useEpics } from '../../hooks/useEpicQueries';
import { useProjects } from '../../hooks/useProjectQueries';

export const runtime = 'edge';

export default function ProjectDetailPage() {
  const params = useParams();
  const rawName =
    typeof params?.name === 'string'
      ? params.name
      : Array.isArray(params?.name)
        ? params.name[0]
        : '';
  const categoryName = decodeURIComponent(rawName || '');
  const { status } = useSession();

  const {
    data: projects,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    error: projectsError,
  } = useProjects();
  const {
    data: epics,
    isLoading: isEpicsLoading,
    isError: isEpicsError,
    error: epicsError,
  } = useEpics();

  if (status === 'loading' || isProjectsLoading || isEpicsLoading) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="lg" role="status" aria-label="Loading category details">
          <Skeleton height={28} width={200} radius="sm" />
          <Skeleton height={110} radius="md" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={52} radius="sm" />
          ))}
        </Stack>
      </Container>
    );
  }

  if (isProjectsError || isEpicsError) {
    return (
      <Container size="lg" py="xl">
        <Alert title="Error loading category" color="red">
          {projectsError?.message || epicsError?.message || 'Could not load category details.'}
        </Alert>
      </Container>
    );
  }

  if (!categoryName) {
    return (
      <Container size="lg" py="xl">
        <Stack align="flex-start" gap="md">
          <Title order={2}>Category Not Found</Title>
          <Text c="dimmed">No category name was provided.</Text>
          <Button component={Link} href="/projects" variant="light">
            All Projects
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <CategoryDetailView categoryName={categoryName} tasks={projects || []} epics={epics || []} />
  );
}
