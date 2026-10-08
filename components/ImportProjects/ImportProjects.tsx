'use client';

import { useState } from 'react';
import { IconFileImport } from '@tabler/icons-react';
import { Alert, Button, FileButton, Group, List, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { convertImportedProjects, validateImportFile } from '../../app/lib/importValidation';
import type { ProjectCreateInput } from '../../app/types/project.types';

interface ImportProjectsProps {
  opened: boolean;
  onClose: () => void;
  onImport: (projects: ProjectCreateInput[]) => Promise<void>;
}

export function ImportProjects({ opened, onClose, onImport }: ImportProjectsProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewCount, setPreviewCount] = useState<number>(0);
  const [deletedCount, setDeletedCount] = useState<number>(0);

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      setPreviewCount(0);
      setDeletedCount(0);
      return;
    }

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);
      const validated = validateImportFile(data);
      const deleted = validated.projects.filter((p) => p.status === 'deleted').length;
      const active = validated.projects.length - deleted;
      setFile(selectedFile);
      setPreviewCount(active);
      setDeletedCount(deleted);
    } catch (error) {
      notifications.show({
        title: 'Invalid File',
        message:
          error instanceof Error
            ? error.message
            : 'The selected file is not a valid project import file',
        color: 'red',
      });
      setFile(null);
      setPreviewCount(0);
      setDeletedCount(0);
    }
  };

  const handleImport = async () => {
    if (!file) {
      return;
    }

    setIsProcessing(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const validated = validateImportFile(data);
      const projects = convertImportedProjects(validated.projects);

      await onImport(projects);

      notifications.show({
        title: 'Import Successful',
        message: `Successfully imported ${projects.length} projects`,
        color: 'green',
      });

      setFile(null);
      setPreviewCount(0);
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Import Failed',
        message: error instanceof Error ? error.message : 'Failed to import projects',
        color: 'red',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Import Projects" size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Import projects from a JSON file. The file must follow the TimDo project format.
        </Text>

        <Alert title="Supported Format" color="blue">
          <List size="sm" spacing="xs">
            <List.Item>JSON file with a "projects" array</List.Item>
            <List.Item>Each project must have: project, status, priority, size</List.Item>
            <List.Item>Optional fields: reason, notes, id</List.Item>
          </List>
        </Alert>

        <FileButton onChange={handleFileSelect} accept="application/json">
          {(props) => (
            <Button {...props} leftSection={<IconFileImport size={16} />} variant="light" fullWidth>
              {file ? `Selected: ${file.name}` : 'Select JSON File'}
            </Button>
          )}
        </FileButton>

        {previewCount > 0 && (
          <Alert title="Ready to Import" color="green">
            <Stack gap="xs">
              <Text size="sm">
                Will import {previewCount} {previewCount === 1 ? 'project' : 'projects'}
              </Text>
              {deletedCount > 0 && (
                <Text size="xs" c="dimmed">
                  ({deletedCount} deleted {deletedCount === 1 ? 'project' : 'projects'} will be
                  skipped)
                </Text>
              )}
            </Stack>
          </Alert>
        )}

        <Group justify="space-between">
          <Button variant="subtle" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isProcessing} loading={isProcessing}>
            Import {previewCount > 0 && `${previewCount} Projects`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
