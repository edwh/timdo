'use client';

import React, { useState } from 'react';
import {
  IconCheck,
  IconDownload,
  IconEdit,
  IconEye,
  IconFlag,
  IconListCheck,
  IconPlus,
  IconPrinter,
  IconTarget,
  IconTrash,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useCreateGoal, useDeleteGoal, useUpdateGoal } from '../../app/hooks/useGoalQueries';
import { getPosterSvgUrl } from '../../app/lib/apiClient';
import type { Epic } from '../../app/types/epic.types';
import type { Goal, GoalCreateInput, GoalType } from '../../app/types/goal.types';
import type { Project } from '../../app/types/project.types';

interface GoalsDashboardViewProps {
  goals: Goal[];
  projects: Project[];
  epics: Epic[];
  accessToken?: string;
}

export function GoalsDashboardView({
  goals,
  projects,
  epics,
  accessToken,
}: GoalsDashboardViewProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure();
  const [createType, setCreateType] = useState<GoalType>('aim');

  const updateGoalMutation = useUpdateGoal();
  const createGoalMutation = useCreateGoal();
  const deleteGoalMutation = useDeleteGoal();

  const aims = goals.filter((g) => g.type === 'aim').sort((a, b) => a.orderIndex - b.orderIndex);
  const focuses = goals
    .filter((g) => g.type === 'focus')
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const values = goals
    .filter((g) => g.type === 'value')
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const housekeeping = goals
    .filter((g) => g.type === 'housekeeping')
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const form = useForm<GoalCreateInput>({
    initialValues: {
      type: 'aim',
      title: '',
      description: '',
      icon: '',
      orderIndex: 0,
      isActive: true,
    },
    validate: {
      title: (val) => (val && val.trim().length > 0 ? null : 'Title is required'),
    },
  });

  const handleOpenCreateModal = (type: GoalType) => {
    setCreateType(type);
    form.setValues({
      type,
      title: '',
      description: '',
      icon: type === 'aim' || type === 'focus' ? '🎯' : '',
      orderIndex: 0,
      isActive: true,
    });
    openCreateModal();
  };

  const handleCreateSubmit = (values: typeof form.values) => {
    createGoalMutation.mutate(values, {
      onSuccess: () => {
        form.reset();
        closeCreateModal();
      },
    });
  };

  const handleInlineSave = (
    goalId: string,
    updates: { title?: string; description?: string; icon?: string }
  ) => {
    updateGoalMutation.mutate({
      goalId,
      data: updates,
    });
  };

  const handleDelete = (goalId: string) => {
    deleteGoalMutation.mutate(goalId);
  };

  const handleDownloadSvg = async () => {
    try {
      const url = getPosterSvgUrl();
      const headers: HeadersInit = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error('Failed to generate SVG poster');
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'goals_poster.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      notifications.show({
        title: 'Poster Downloaded',
        message: 'Downloaded dynamic goals_poster.svg',
        color: 'green',
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Download failed';
      notifications.show({
        title: 'Download Failed',
        message: errorMsg,
        color: 'red',
      });
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header Bar */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1}>Life Goals Dashboard</Title>
            <Text c="dimmed" size="sm">
              Long-term Aims, Current Focuses, Core Values, and Housekeeping Habits.
            </Text>
            <Text c="dimmed" size="xs" mt={4}>
              Private to you. People you share workspaces with never see your goals or which tasks
              you link to them.
            </Text>
          </div>

          <Group gap="xs">
            <Button
              variant={isEditMode ? 'filled' : 'light'}
              color={isEditMode ? 'blue' : 'gray'}
              leftSection={isEditMode ? <IconCheck size={16} /> : <IconEdit size={16} />}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              {isEditMode ? 'Done Editing' : 'Edit Poster'}
            </Button>
            <Button
              variant="outline"
              color="indigo"
              leftSection={<IconDownload size={16} />}
              onClick={handleDownloadSvg}
            >
              Download SVG
            </Button>
            <Button
              variant="default"
              leftSection={<IconPrinter size={16} />}
              onClick={handlePrintPdf}
            >
              Print / PDF
            </Button>
          </Group>
        </Group>

        {/* Section 1: Aims (What I'm Working Towards) */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Group gap="xs">
                  <ThemeIcon size={32} radius="md" color="indigo" variant="light">
                    <IconTarget size={18} />
                  </ThemeIcon>
                  <Title order={2} size="h3">
                    Top Aims
                  </Title>
                </Group>
                <Text size="xs" c="dimmed">
                  Core life-defining outcomes (Family, Career/Wealth, Adventure)
                </Text>
              </div>

              {isEditMode && (
                <Button
                  size="xs"
                  variant="light"
                  color="indigo"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => handleOpenCreateModal('aim')}
                >
                  Add Aim
                </Button>
              )}
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {aims.map((aim) => {
                const linkedTasks = projects.filter((p) => p.goalId === aim.id);
                const activeTasks = linkedTasks.filter(
                  (p) => p.status === 'do' || p.status === 'awaiting'
                );
                const linkedEpics = epics.filter((e) => e.goalId === aim.id);

                return (
                  <Card key={aim.id} withBorder p="md" radius="md" style={{ position: 'relative' }}>
                    {isEditMode ? (
                      <Stack gap="xs">
                        <Group gap="xs">
                          <TextInput
                            placeholder="Icon (e.g. 🚀)"
                            defaultValue={aim.icon || ''}
                            w={60}
                            size="xs"
                            onBlur={(e) => handleInlineSave(aim.id, { icon: e.target.value })}
                          />
                          <TextInput
                            placeholder="Aim Title"
                            defaultValue={aim.title}
                            style={{ flex: 1 }}
                            size="xs"
                            fw={600}
                            onBlur={(e) => handleInlineSave(aim.id, { title: e.target.value })}
                          />
                          <ActionIcon
                            size="sm"
                            color="red"
                            variant="subtle"
                            onClick={() => handleDelete(aim.id)}
                            aria-label={`Delete ${aim.title}`}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                        <Textarea
                          placeholder="Description or context..."
                          defaultValue={aim.description || ''}
                          autosize
                          minRows={2}
                          size="xs"
                          onBlur={(e) => handleInlineSave(aim.id, { description: e.target.value })}
                        />
                      </Stack>
                    ) : (
                      <Stack justify="space-between" h="100%" gap="xs">
                        <div>
                          <Group gap="xs" mb={4} align="center">
                            {aim.icon && <Text size="xl">{aim.icon}</Text>}
                            <Title order={4} size="h5" style={{ flex: 1 }}>
                              {aim.title}
                            </Title>
                          </Group>
                          {aim.description && (
                            <Text size="xs" c="dimmed">
                              {aim.description}
                            </Text>
                          )}
                        </div>

                        <Group gap="xs" mt="xs">
                          {activeTasks.length > 0 && (
                            <Badge
                              size="sm"
                              variant="light"
                              color="blue"
                              leftSection={<IconListCheck size={12} />}
                            >
                              {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'}
                            </Badge>
                          )}
                          {linkedEpics.length > 0 && (
                            <Badge
                              size="sm"
                              variant="light"
                              color="violet"
                              leftSection={<IconFlag size={12} />}
                            >
                              {linkedEpics.length} {linkedEpics.length === 1 ? 'epic' : 'epics'}
                            </Badge>
                          )}
                        </Group>
                      </Stack>
                    )}
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Card>

        {/* Section 2: Focuses */}
        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Group gap="xs">
                  <ThemeIcon size={32} radius="md" color="teal" variant="light">
                    <IconEye size={18} />
                  </ThemeIcon>
                  <Title order={2} size="h3">
                    Current Focuses
                  </Title>
                </Group>
                <Text size="xs" c="dimmed">
                  Specific active priorities and areas of continuous attention
                </Text>
              </div>

              {isEditMode && (
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => handleOpenCreateModal('focus')}
                >
                  Add Focus
                </Button>
              )}
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {focuses.map((focus) => {
                const linkedTasks = projects.filter((p) => p.goalId === focus.id);
                const activeTasks = linkedTasks.filter(
                  (p) => p.status === 'do' || p.status === 'awaiting'
                );
                const linkedEpics = epics.filter((e) => e.goalId === focus.id);

                return (
                  <Card key={focus.id} withBorder p="md" radius="md">
                    {isEditMode ? (
                      <Stack gap="xs">
                        <Group gap="xs">
                          <TextInput
                            placeholder="Icon"
                            defaultValue={focus.icon || ''}
                            w={60}
                            size="xs"
                            onBlur={(e) => handleInlineSave(focus.id, { icon: e.target.value })}
                          />
                          <TextInput
                            placeholder="Focus Title"
                            defaultValue={focus.title}
                            style={{ flex: 1 }}
                            size="xs"
                            fw={600}
                            onBlur={(e) => handleInlineSave(focus.id, { title: e.target.value })}
                          />
                          <ActionIcon
                            size="sm"
                            color="red"
                            variant="subtle"
                            onClick={() => handleDelete(focus.id)}
                            aria-label={`Delete ${focus.title}`}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                        <Textarea
                          placeholder="Description..."
                          defaultValue={focus.description || ''}
                          autosize
                          minRows={1}
                          size="xs"
                          onBlur={(e) =>
                            handleInlineSave(focus.id, { description: e.target.value })
                          }
                        />
                      </Stack>
                    ) : (
                      <Stack justify="space-between" h="100%" gap="xs">
                        <div>
                          <Group gap="xs" align="center" mb={4}>
                            {focus.icon && <Text size="lg">{focus.icon}</Text>}
                            <Text fw={600} size="sm" style={{ flex: 1 }}>
                              {focus.title}
                            </Text>
                          </Group>
                          {focus.description && (
                            <Text size="xs" c="dimmed">
                              {focus.description}
                            </Text>
                          )}
                        </div>

                        <Group gap="xs">
                          {activeTasks.length > 0 && (
                            <Badge size="xs" variant="light" color="blue">
                              {activeTasks.length} active tasks
                            </Badge>
                          )}
                          {linkedEpics.length > 0 && (
                            <Badge size="xs" variant="light" color="violet">
                              {linkedEpics.length} epics
                            </Badge>
                          )}
                        </Group>
                      </Stack>
                    )}
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Card>

        {/* Section 3: Core Values & Regular Tasks (Housekeeping) */}
        <Grid gutter="md">
          {/* Core Values */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder p="lg" radius="md" h="100%">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Title order={2} size="h3">
                    Core Values
                  </Title>
                  {isEditMode && (
                    <Button
                      size="xs"
                      variant="light"
                      color="orange"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => handleOpenCreateModal('value')}
                    >
                      Add Value
                    </Button>
                  )}
                </Group>

                <Stack gap="xs">
                  {values.map((val, idx) => (
                    <Paper key={val.id} withBorder p="sm" radius="sm">
                      {isEditMode ? (
                        <Stack gap="xs">
                          <Group gap="xs">
                            <TextInput
                              placeholder="Value Title"
                              defaultValue={val.title}
                              style={{ flex: 1 }}
                              size="xs"
                              fw={600}
                              onBlur={(e) => handleInlineSave(val.id, { title: e.target.value })}
                            />
                            <ActionIcon
                              size="sm"
                              color="red"
                              variant="subtle"
                              onClick={() => handleDelete(val.id)}
                              aria-label={`Delete ${val.title}`}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                          <Textarea
                            placeholder="Guiding principle description..."
                            defaultValue={val.description || ''}
                            autosize
                            minRows={2}
                            size="xs"
                            onBlur={(e) =>
                              handleInlineSave(val.id, { description: e.target.value })
                            }
                          />
                        </Stack>
                      ) : (
                        <div>
                          <Text fw={600} size="sm">
                            {idx + 1}) {val.title.replace(/^\d+\)\s*/, '')}
                          </Text>
                          {val.description && (
                            <Text size="xs" c="dimmed" mt={2}>
                              {val.description}
                            </Text>
                          )}
                        </div>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Regular Tasks / Housekeeping */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder p="lg" radius="md" h="100%">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Title order={2} size="h3">
                    Housekeeping & Habits
                  </Title>
                  {isEditMode && (
                    <Button
                      size="xs"
                      variant="light"
                      color="cyan"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => handleOpenCreateModal('housekeeping')}
                    >
                      Add Group
                    </Button>
                  )}
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  {housekeeping.map((hk) => (
                    <Paper key={hk.id} withBorder p="sm" radius="sm">
                      {isEditMode ? (
                        <Stack gap="xs">
                          <Group gap="xs">
                            <TextInput
                              placeholder="Cadence (e.g. Weekly)"
                              defaultValue={hk.title}
                              style={{ flex: 1 }}
                              size="xs"
                              fw={600}
                              onBlur={(e) => handleInlineSave(hk.id, { title: e.target.value })}
                            />
                            <ActionIcon
                              size="sm"
                              color="red"
                              variant="subtle"
                              onClick={() => handleDelete(hk.id)}
                              aria-label={`Delete ${hk.title}`}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                          <Textarea
                            placeholder="Tasks list (one per line)..."
                            defaultValue={hk.description || ''}
                            autosize
                            minRows={3}
                            size="xs"
                            onBlur={(e) => handleInlineSave(hk.id, { description: e.target.value })}
                          />
                        </Stack>
                      ) : (
                        <div>
                          <Badge size="xs" color="gray" variant="filled" mb="xs">
                            {hk.title}
                          </Badge>
                          <Stack gap={2}>
                            {(hk.description || '')
                              .split('\n')
                              .filter((line) => line.trim().length > 0)
                              .map((line, lIdx) => (
                                <Text key={lIdx} size="xs" c="dimmed">
                                  {line.trim().startsWith('▸') ? line.trim() : `▸ ${line.trim()}`}
                                </Text>
                              ))}
                          </Stack>
                        </div>
                      )}
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>

      {/* Create Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={`Add New ${createType.toUpperCase()}`}
        centered
      >
        <form onSubmit={form.onSubmit(handleCreateSubmit)}>
          <Stack gap="sm">
            <Select
              label="Goal Type"
              data={[
                { value: 'aim', label: 'Aim (Top Life Outcome)' },
                { value: 'focus', label: 'Focus (Active Priority)' },
                { value: 'value', label: 'Core Value' },
                { value: 'housekeeping', label: 'Housekeeping / Habit' },
              ]}
              {...form.getInputProps('type')}
            />

            {(form.values.type === 'aim' || form.values.type === 'focus') && (
              <TextInput
                label="Icon / Emoji"
                placeholder="e.g. 🎯 or 👨‍👩‍👦"
                {...form.getInputProps('icon')}
              />
            )}

            <TextInput
              label="Title"
              placeholder="e.g. Relentless Optimism"
              required
              data-autofocus
              {...form.getInputProps('title')}
            />

            <Textarea
              label="Description / Details"
              placeholder="Guiding principles or bulleted routines..."
              autosize
              minRows={3}
              {...form.getInputProps('description')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button type="submit" color="indigo">
                Add Item
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
