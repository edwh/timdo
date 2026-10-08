'use client';

import { useState } from 'react';
import { Button, Container, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import type { ProjectCreateInput } from '../../app/types/project.types';

interface OnboardingTypingFormProps {
  onComplete: (projects: ProjectCreateInput[]) => void;
}

export function OnboardingTypingForm({ onComplete }: OnboardingTypingFormProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [projects, setProjects] = useState<ProjectCreateInput[]>([]);
  const [projectName, setProjectName] = useState('');
  const [reason, setReason] = useState('');

  const handleNext = () => {
    const newProject: ProjectCreateInput = {
      project: projectName,
      reason,
      status: 'do',
      priority: 5,
      size: '***',
      notes: '',
    };

    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);

    if (updatedProjects.length === 5) {
      onComplete(updatedProjects);
    } else {
      setCurrentIndex(currentIndex + 1);
      setProjectName('');
      setReason('');
    }
  };

  const canProceed = projectName.trim().length > 0 && reason.trim().length > 0;

  return (
    <Container
      size="sm"
      style={{
        paddingTop: 'var(--mantine-spacing-xl)',
        paddingBottom: 'var(--mantine-spacing-xl)',
      }}
    >
      <Stack gap="xl">
        <Title order={1} ta="center">
          Let's Type Instead
        </Title>

        <Text ta="center" c="dimmed">
          No worries - we can do this with typing. Add your 5 projects below.
        </Text>

        <Paper withBorder p="lg" radius="md">
          <Stack gap="md">
            <Text fw={500} size="lg">
              Project {currentIndex + 1} of 5
            </Text>

            <TextInput
              label="Project name"
              placeholder="e.g., Finish quarterly report"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              data-autofocus
            />

            <TextInput
              label="Reason"
              placeholder="e.g., Board meeting next week"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <Button onClick={handleNext} disabled={!canProceed} fullWidth mt="md">
              {currentIndex === 4 ? 'Review Projects' : 'Next Project →'}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
