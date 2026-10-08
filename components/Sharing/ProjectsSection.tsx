'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  IconArchive,
  IconArchiveOff,
  IconArrowsExchange,
  IconDots,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  useAddWorkspaceProject,
  useUpdateWorkspaceProject,
} from '../../app/hooks/useSharingQueries';
import type { SharingProject, SharingWorkspace } from '../../app/types/collaboration.types';
import { ConfirmModal } from './ConfirmModal';
import { canEdit, canManage, joinNames, moveImpact, plural, workspaceLabel } from './sharingRules';

type Dialog =
  | { type: 'rename'; project: SharingProject }
  | { type: 'move'; project: SharingProject }
  | { type: 'add' }
  | null;

function RenameProjectModal({
  project,
  onClose,
  onSave,
  loading,
}: {
  project: SharingProject;
  onClose: () => void;
  onSave: (name: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(project.name);
  const trimmed = name.trim();
  return (
    <Modal opened onClose={onClose} title="Rename project" centered radius="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && trimmed !== project.name) {
            onSave(trimmed);
          }
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Project name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            maxLength={80}
            data-autofocus
            description="Tasks and epics in this project keep their history."
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!trimmed || trimmed === project.name}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function AddProjectModal({
  workspaceName,
  onClose,
  onSave,
  loading,
}: {
  workspaceName: string;
  onClose: () => void;
  onSave: (data: { name: string; description: string | null }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return (
    <Modal
      opened
      onClose={onClose}
      title={`Add a project to ${workspaceName}`}
      centered
      radius="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            onSave({ name: name.trim(), description: description.trim() || null });
          }
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Project name"
            placeholder="e.g. Website relaunch"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            maxLength={80}
            required
            data-autofocus
          />
          <Textarea
            label="Description"
            placeholder="Optional"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!name.trim()}>
              Add project
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function MoveProjectModal({
  project,
  source,
  destinations,
  onClose,
  onMove,
  loading,
}: {
  project: SharingProject;
  source: SharingWorkspace;
  destinations: SharingWorkspace[];
  onClose: () => void;
  onMove: (destination: SharingWorkspace) => void;
  loading: boolean;
}) {
  const [destinationId, setDestinationId] = useState<string | null>(
    destinations.length === 1 ? destinations[0].id : null
  );
  const destination = destinations.find((d) => d.id === destinationId) || null;
  const taskCount = project.openTasks + project.doneTasks;
  const impact = destination ? moveImpact(source, destination) : null;
  const sourceName = workspaceLabel(source);
  const destName = destination ? workspaceLabel(destination) : '';

  return (
    <ConfirmModal
      opened
      onClose={onClose}
      onConfirm={() => destination && onMove(destination)}
      title={`Move ${project.name}`}
      confirmLabel={destination ? `Move to ${destName}` : 'Move'}
      confirmDisabled={!destination}
      loading={loading}
    >
      <Select
        label="Move to workspace"
        placeholder="Choose a workspace"
        data={destinations.map((d) => ({ value: d.id, label: workspaceLabel(d) }))}
        value={destinationId}
        onChange={setDestinationId}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        data-testid="move-destination-select"
      />
      {destination && impact && (
        <Alert color="orange" variant="light" data-testid="move-impact">
          <Stack gap={6}>
            <Text size="sm">
              Everyone in {destName} will be able to see its {plural(taskCount, 'task')} and{' '}
              {plural(project.epicCount, 'epic')}. People in {sourceName} who aren&apos;t in{' '}
              {destName} will lose access.
            </Text>
            {impact.gaining.length > 0 && (
              <Text size="sm">
                <Text span inherit fw={600}>
                  Gains access:
                </Text>{' '}
                {joinNames(impact.gaining)}
              </Text>
            )}
            {impact.losing.length > 0 && (
              <Text size="sm">
                <Text span inherit fw={600}>
                  Loses access:
                </Text>{' '}
                {joinNames(impact.losing)}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              Tasks keep their history and notes.
            </Text>
          </Stack>
        </Alert>
      )}
    </ConfirmModal>
  );
}

export function ProjectsSection({
  workspace,
  allWorkspaces,
}: {
  workspace: SharingWorkspace;
  allWorkspaces: SharingWorkspace[];
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const update = useUpdateWorkspaceProject(workspace.id);
  const add = useAddWorkspaceProject(workspace.id);
  const manage = canManage(workspace.role);
  const destinations = allWorkspaces.filter((w) => w.id !== workspace.id && canEdit(w.role));
  const close = () => setDialog(null);
  const label = workspaceLabel(workspace);

  const projects = [...workspace.projects].sort(
    (a, b) => Number(a.isArchived) - Number(b.isArchived) || a.name.localeCompare(b.name)
  );

  return (
    <Box>
      <Group justify="space-between" mb="xs" gap="xs">
        <Text fw={600} size="sm">
          Projects
        </Text>
        {manage && (
          <Button
            size="xs"
            variant="subtle"
            leftSection={<IconPlus size={14} />}
            onClick={() => setDialog({ type: 'add' })}
          >
            Add project
          </Button>
        )}
      </Group>

      {projects.length === 0 ? (
        <Text size="sm" c="dimmed">
          No projects yet.{manage ? ' Add one, or move one here from another workspace.' : ''}
        </Text>
      ) : (
        <Stack gap={0} component="ul" m={0} p={0} aria-label={`Projects in ${label}`}>
          {projects.map((project, i) => (
            <Group
              component="li"
              key={project.id}
              wrap="nowrap"
              gap="sm"
              py={8}
              style={{
                listStyle: 'none',
                opacity: project.isArchived ? 0.65 : 1,
                borderTop:
                  i === 0
                    ? undefined
                    : '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
              }}
              data-testid={`project-row-${project.id}`}
            >
              <Badge
                variant="outline"
                color="gray"
                radius="sm"
                w={48}
                style={{ flexShrink: 0, fontFamily: 'var(--mantine-font-family-monospace)' }}
              >
                {project.key}
              </Badge>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  <Anchor
                    component={Link}
                    href={`/projects/${encodeURIComponent(project.name)}`}
                    size="sm"
                    fw={500}
                    c="inherit"
                    underline="hover"
                    truncate
                  >
                    {project.name}
                  </Anchor>
                  {project.isArchived && (
                    <Badge size="xs" variant="light" color="gray">
                      Archived
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {project.openTasks} open · {project.doneTasks} done ·{' '}
                  {plural(project.epicCount, 'epic')}
                </Text>
              </Box>
              {manage && (
                <Menu position="bottom-end" withinPortal shadow="md">
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Actions for ${project.name}`}
                      data-testid={`project-menu-${project.id}`}
                    >
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconPencil size={14} />}
                      onClick={() => setDialog({ type: 'rename', project })}
                    >
                      Rename
                    </Menu.Item>
                    <Menu.Item
                      leftSection={
                        project.isArchived ? (
                          <IconArchiveOff size={14} />
                        ) : (
                          <IconArchive size={14} />
                        )
                      }
                      onClick={() =>
                        update.mutate({
                          projectId: project.id,
                          data: { isArchived: !project.isArchived },
                          successMessage: project.isArchived
                            ? `${project.name} is back in use`
                            : `Archived ${project.name}`,
                        })
                      }
                    >
                      {project.isArchived ? 'Unarchive' : 'Archive'}
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconArrowsExchange size={14} />}
                      disabled={destinations.length === 0}
                      onClick={() => setDialog({ type: 'move', project })}
                    >
                      Move to workspace…
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          ))}
        </Stack>
      )}

      {dialog?.type === 'rename' && (
        <RenameProjectModal
          project={dialog.project}
          onClose={close}
          loading={update.isPending}
          onSave={(name) =>
            update.mutate(
              {
                projectId: dialog.project.id,
                data: { name },
                successMessage: `Renamed to ${name}`,
              },
              { onSuccess: close }
            )
          }
        />
      )}

      {dialog?.type === 'move' && (
        <MoveProjectModal
          project={dialog.project}
          source={workspace}
          destinations={destinations}
          onClose={close}
          loading={update.isPending}
          onMove={(destination) =>
            update.mutate(
              {
                projectId: dialog.project.id,
                data: { orgId: destination.id },
                successMessage: `Moved ${dialog.project.name} to ${workspaceLabel(destination)}`,
              },
              { onSuccess: close }
            )
          }
        />
      )}

      {dialog?.type === 'add' && (
        <AddProjectModal
          workspaceName={label}
          onClose={close}
          loading={add.isPending}
          onSave={(data) => add.mutate(data, { onSuccess: close })}
        />
      )}
    </Box>
  );
}
