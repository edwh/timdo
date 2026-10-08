'use client';

import { IconMicrophone, IconPlayerStopFilled } from '@tabler/icons-react';
import { Button, Code, Container, Paper, Stack, Text, Title } from '@mantine/core';
import classes from './OnboardingWelcome.module.css';

interface OnboardingWelcomeProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function OnboardingWelcome({
  isRecording,
  onStartRecording,
  onStopRecording,
}: OnboardingWelcomeProps) {
  return (
    <Container size="sm" className={classes.container}>
      <Stack gap="xl" align="center">
        <Title order={1} ta="center" className={classes.title}>
          Get Everything Out of Your Head
        </Title>

        <Text size="lg" ta="center" c="dimmed" maw={600}>
          The best way to think clearly is to get it all out. You'll list 5 big things on your mind
          right now.
        </Text>

        <Text size="md" ta="center" maw={600}>
          Don't overthink it - just speak naturally. You can edit after.
        </Text>

        <Paper withBorder p="lg" radius="md" className={classes.scriptBox}>
          <Text fw={500} mb="xs">
            For each project, say:
          </Text>
          <Code block className={classes.codeBlock}>
            {`"New project: [name]
 Reason: [why it matters]
 Priority: [1-10]
 Stars: [1-5 stars]
 Notes: [any details]"`}
          </Code>
        </Paper>

        <Button
          size="xl"
          leftSection={
            isRecording ? <IconPlayerStopFilled size={24} /> : <IconMicrophone size={24} />
          }
          onClick={isRecording ? onStopRecording : onStartRecording}
          color={isRecording ? 'red' : 'blue'}
          className={isRecording ? classes.recordingButton : undefined}
          variant={isRecording ? 'filled' : 'filled'}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Button>

        <Text size="sm" c="dimmed">
          This doesn't need to be perfect
        </Text>
      </Stack>
    </Container>
  );
}
