'use client';

import React, { useMemo, useState } from 'react';
import { IconGitMerge } from '@tabler/icons-react';
import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { useMergeProjects } from '../../app/hooks/useProjectMutations';
import type { Project } from '../../app/types/project.types';

export interface MergeTaskModalProps {
  opened: boolean;
  onClose: () => void;
  currentTask: Project;
  allTasks: Project[];
}

export function MergeTaskModal({ opened, onClose, currentTask, allTasks }: MergeTaskModalProps) {
  const [direction, setDirection] = useState<'into_this' | 'this_into_other'>('into_this');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const mergeMutation = useMergeProjects();

  const selectableTasks = useMemo(() => {
    return allTasks
      .filter((t) => t.id !== currentTask.id && !t.isDeleted)
      .map((t) => ({
        value: t.id,
        label: `[${t.priority}] ${t.project} (${t.id.slice(0, 8)}) [${t.status}]`,
      }));
  }, [allTasks, currentTask.id]);

  const selectedOtherTask = useMemo(() => {
    return allTasks.find((t) => t.id === selectedTaskId) || null;
  }, [allTasks, selectedTaskId]);

  const targetTask = direction === 'into_this' ? currentTask : selectedOtherTask;
  const sourceTask = direction === 'into_this' ? selectedOtherTask : currentTask;

  const handleMerge = async () => {
    if (!targetTask || !sourceTask) {
      return;
    }
    await mergeMutation.mutateAsync({
      targetId: targetTask.id,
      sourceId: sourceTask.id,
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconGitMerge size={20} />
          <Text fw={700}>Merge Tasks</Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap="md">
        <SegmentedControl
          value={direction}
          onChange={(val) => setDirection(val as 'into_this' | 'this_into_other')}
          data={[
            { label: 'Merge another task into this one', value: 'into_this' },
            { label: 'Merge this task into another', value: 'this_into_other' },
          ]}
        />

        <Select
          label="Select the other task to merge with"
          placeholder="Search task by title or ID..."
          data={selectableTasks}
          value={selectedTaskId}
          onChange={setSelectedTaskId}
          searchable
          clearable
        />

        {targetTask && sourceTask && (
          <Paper p="md" withBorder radius="md" bg="var(--mantine-color-dark-8, #1a1b1e)">
            <Text size="sm" fw={600} mb="xs">
              Preview Merge Outcome
            </Text>
            <Group grow align="stretch">
              <Paper p="sm" withBorder style={{ borderColor: 'var(--mantine-color-green-7)' }}>
                <Badge color="green" mb="xs">
                  KEEPING (Surviving Task)
                </Badge>
                <Text fw={600} size="sm">
                  {targetTask.project}
                </Text>
                <Text size="xs" c="dimmed">
                  Priority: {Math.max(targetTask.priority, sourceTask.priority)} | Size:{' '}
                  {targetTask.size}
                </Text>
              </Paper>

              <Paper
                p="sm"
                withBorder
                style={{ borderStyle: 'dashed', borderColor: 'var(--mantine-color-red-7)' }}
              >
                <Badge color="red" mb="xs">
                  ABSORBING (Will Be Archived)
                </Badge>
                <Text fw={600} size="sm">
                  {sourceTask.project}
                </Text>
                <Text size="xs" c="dimmed">
                  Notes and updates will transfer to surviving task.
                </Text>
              </Paper>
            </Group>
          </Paper>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="blue"
            leftSection={<IconGitMerge size={16} />}
            disabled={!selectedTaskId || mergeMutation.isPending}
            loading={mergeMutation.isPending}
            onClick={handleMerge}
          >
            Confirm & Merge
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
