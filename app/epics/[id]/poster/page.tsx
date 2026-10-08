'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IconArrowLeft, IconDownload, IconPrinter } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import PrintableSvgPoster from '../../../../components/TimDoPage/PrintableSvgPoster';
import { useEpic } from '../../../hooks/useEpicQueries';
import { useProjects } from '../../../hooks/useProjectQueries';

export const runtime = 'edge';

export default function EpicPosterPage() {
  const params = useParams();
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const { data: session, status } = useSession();

  const { data: epic, isLoading: isEpicsLoading, isError: isEpicsError } = useEpic(id);
  const { data: projects, isLoading: isProjectsLoading, isError: isProjectsError } = useProjects();

  // Every task in the epic, whoever it's assigned to: an epic poster is about the epic
  const epicTasks = useMemo(
    () => (projects || []).filter((p) => p.epicId === id && !p.isDeleted),
    [projects, id]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSvg = () => {
    const svgEl = document.querySelector('#epic-poster-container svg');
    if (!svgEl) {
      return;
    }
    const svgContent = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epic-${epic?.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'poster'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (status === 'loading' || isEpicsLoading || isProjectsLoading) {
    return (
      <Container size="lg" py="xl">
        <Loader role="status" aria-label="Loading epic poster" />
      </Container>
    );
  }

  if (isEpicsError || isProjectsError || !epic) {
    return (
      <Container size="lg" py="xl">
        <Alert title="Error" color="red">
          Could not load epic poster.
        </Alert>
        <Button component={Link} href="/epics" mt="md" variant="subtle">
          Back to Epics
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Navigation & Print Controls */}
        <Group justify="space-between" align="center" className="no-print">
          <Button
            component={Link}
            href={`/epics/${epic.id}`}
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            size="sm"
          >
            Back to {epic.title}
          </Button>

          <Group gap="xs">
            <Button
              variant="outline"
              color="gray"
              leftSection={<IconDownload size={14} />}
              size="sm"
              onClick={handleDownloadSvg}
            >
              Download SVG
            </Button>
            <Button
              variant="filled"
              color="violet"
              leftSection={<IconPrinter size={14} />}
              size="sm"
              onClick={handlePrint}
            >
              Print A2/A4 Poster
            </Button>
          </Group>
        </Group>

        <Box className="no-print">
          <Title order={2}>Epic Campaign Poster: {epic.title}</Title>
          <Text c="dimmed" size="sm">
            Self-contained printable worksheet for this epic across DO, AWAITING, DELAY, and DONE (
            {epicTasks.length} tasks).
          </Text>
        </Box>

        {/* Printable Poster Canvas */}
        <Paper
          withBorder
          p="md"
          radius="md"
          style={{
            display: 'flex',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa',
            overflowX: 'auto',
          }}
        >
          <div id="epic-poster-container" style={{ maxWidth: '100%' }}>
            <PrintableSvgPoster
              projects={epicTasks}
              // Shared epics belong to the team, so credit the workspace rather than one person
              user={(epic.isShared && epic.orgName) || session?.user?.name || 'TimDo'}
              customTitle={`EPIC: ${epic.title}`}
              mode="tasks"
            />
          </div>
        </Paper>
      </Stack>
    </Container>
  );
}
