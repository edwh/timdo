'use client';

import { useState } from 'react';
import { Button, Container, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import type { ProjectCreateInput } from '../../app/types/project.types';
import classes from './OnboardingReview.module.css';

interface OnboardingReviewProps {
  projects: ProjectCreateInput[];
  onProjectsChange: (projects: ProjectCreateInput[]) => void;
  onContinue: () => void;
}

export function OnboardingReview({
  projects,
  onProjectsChange,
  onContinue,
}: OnboardingReviewProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ project: string; reason: string }>({
    project: '',
    reason: '',
  });

  const handleEditClick = (index: number) => {
    setEditingIndex(index);
    setEditForm({
      project: projects[index]?.project || '',
      reason: projects[index]?.reason || '',
    });
  };

  const handleSaveEdit = (index: number) => {
    const updatedProjects = [...projects];
    updatedProjects[index] = {
      ...updatedProjects[index],
      project: editForm.project,
      reason: editForm.reason,
    };
    onProjectsChange(updatedProjects);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleAddProject = (index: number) => {
    setEditingIndex(index);
    setEditForm({ project: '', reason: '' });
  };

  const missingCount = Math.max(0, 5 - projects.length);
  const canContinue = projects.length >= 5;

  return (
    <Container size="sm" className={classes.container}>
      <Stack gap="xl">
        <Title order={1} ta="center">
          Your Projects
        </Title>

        <Stack gap="md">
          {projects.map((project, index) => (
            <Paper key={index} withBorder p="md" radius="md">
              {editingIndex === index ? (
                <Stack gap="sm">
                  <TextInput
                    label="Project name"
                    placeholder="e.g., Finish quarterly report"
                    value={editForm.project}
                    onChange={(e) => setEditForm({ ...editForm, project: e.target.value })}
                  />
                  <TextInput
                    label="Reason"
                    placeholder="e.g., Board meeting next week"
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  />
                  <Group justify="flex-end">
                    <Button variant="default" size="xs" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button size="xs" onClick={() => handleSaveEdit(index)}>
                      Save
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <>
                  <Group justify="space-between" mb="xs">
                    <Text fw={500} size="lg">
                      ✓ {index + 1}. {project.project}
                    </Text>
                    <Button variant="subtle" size="xs" onClick={() => handleEditClick(index)}>
                      Edit
                    </Button>
                  </Group>
                  <Text c="dimmed">Reason: {project.reason}</Text>
                </>
              )}
            </Paper>
          ))}

          {Array.from({ length: missingCount }).map((_, i) => {
            const index = projects.length + i;
            return (
              <Paper
                key={`missing-${i}`}
                withBorder
                p="md"
                radius="md"
                className={classes.emptyProject}
              >
                {editingIndex === index ? (
                  <Stack gap="sm">
                    <TextInput
                      label="Project name"
                      placeholder="e.g., Organize garage"
                      value={editForm.project}
                      onChange={(e) => setEditForm({ ...editForm, project: e.target.value })}
                      data-autofocus
                    />
                    <TextInput
                      label="Reason"
                      placeholder="e.g., Can't find anything"
                      value={editForm.reason}
                      onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    />
                    <Group justify="flex-end">
                      <Button variant="default" size="xs" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => {
                          const newProjects = [...projects];
                          newProjects.push({
                            project: editForm.project,
                            reason: editForm.reason,
                            status: 'do',
                            priority: 5,
                            size: '***',
                            notes: '',
                          });
                          onProjectsChange(newProjects);
                          setEditingIndex(null);
                        }}
                        disabled={!editForm.project || !editForm.reason}
                      >
                        Save
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <>
                    <Text c="dimmed" fw={500}>
                      ○ Project {index + 1}
                    </Text>
                    <Button
                      variant="light"
                      size="xs"
                      mt="xs"
                      onClick={() => handleAddProject(index)}
                    >
                      Add details
                    </Button>
                  </>
                )}
              </Paper>
            );
          })}
        </Stack>

        {!canContinue && (
          <Text ta="center" c="dimmed">
            Almost there! Add {missingCount} more to continue.
          </Text>
        )}

        <Button size="lg" onClick={onContinue} disabled={!canContinue} fullWidth>
          Continue to Your Board
        </Button>
      </Stack>
    </Container>
  );
}
