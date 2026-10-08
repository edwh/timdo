'use client';

import { IconX } from '@tabler/icons-react';
import { ActionIcon, Box, Button, Container, Group, Text } from '@mantine/core';
import classes from './RecordingToolbar.module.css';

interface RecordingToolbarProps {
  isRecording: boolean;
  onStopRecording: () => void;
  onClose: () => void;
}

export function RecordingToolbar({ isRecording, onStopRecording, onClose }: RecordingToolbarProps) {
  if (!isRecording) {
    return null;
  }

  return (
    <Box className={classes.toolbar}>
      <Container size="lg">
        <Group justify="space-between" align="center" h="100%">
          <Group gap="md">
            <div className={classes.pulse} />
            <div>
              <Text size="lg" fw={600} c="red">
                Recording in Progress
              </Text>
              <Text size="sm" c="dimmed">
                Scroll through your board and dictate changes. Click Stop when finished.
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <Button size="lg" color="red" onClick={onStopRecording}>
              Stop Recording
            </Button>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={onClose}
              aria-label="Close (will stop recording)"
            >
              <IconX size={20} />
            </ActionIcon>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}
