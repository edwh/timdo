'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  IconAlertTriangle,
  IconFolder,
  IconHierarchy2,
  IconMicrophone,
  IconUser,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Grid,
  Group,
  List,
  Loader,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  clearVoiceReview,
  loadVoiceReview,
  type VoiceChangeType,
  type VoiceCommandResult,
  type VoiceDraft,
  type VoiceProposal,
} from '../../../components/VoiceCommand/voiceTypes';
import type { Project } from '../../types/project.types';
import { applyVoiceChange, newApplySession, VoiceApplyError } from './applyVoiceChange';

const ACTION: Record<VoiceChangeType, { label: string; color: string }> = {
  create: { label: 'New task', color: 'green' },
  update: { label: 'Update task', color: 'blue' },
  delete: { label: 'Delete task', color: 'red' },
  claim: { label: 'Claim task', color: 'violet' },
  createEpic: { label: 'New epic', color: 'teal' },
  createProject: { label: 'New project', color: 'grape' },
};

const STATUS_LABEL: Record<string, string> = {
  do: 'Do',
  delay: 'Delay',
  done: 'Done',
  delegate: 'Delegate',
  awaiting: 'Awaiting',
};

function TaskSummary({
  task,
  assigneeName,
  muted,
}: {
  task: Partial<Project> | VoiceDraft;
  assigneeName?: string | null;
  muted?: boolean;
}) {
  const status = task.status ? STATUS_LABEL[task.status] || task.status : null;
  return (
    <Stack gap={6} opacity={muted ? 0.6 : 1}>
      <Text size="sm" fw={700} td={muted ? 'line-through' : undefined}>
        {task.project}
      </Text>
      {task.reason && (
        <Text size="xs" c="dimmed">
          {task.reason}
        </Text>
      )}
      <Group gap="xs">
        {status && (
          <Badge size="sm" variant="light" color="gray">
            {status}
            {task.status === 'awaiting' && task.awaitUntil ? ` until ${task.awaitUntil}` : ''}
          </Badge>
        )}
        {task.priority !== undefined && (
          <Badge size="sm" variant="light" color="gray">
            P{task.priority}
          </Badge>
        )}
        {task.size && (
          <Badge size="sm" variant="light" color="gray">
            {task.size}
          </Badge>
        )}
      </Group>
      {assigneeName !== undefined && (
        <Text size="xs" c="dimmed">
          {assigneeName ? `Assigned to ${assigneeName}` : 'Unassigned'}
        </Text>
      )}
      {task.notes && (
        <Text size="xs" c="dimmed" lineClamp={4}>
          {task.notes}
        </Text>
      )}
    </Stack>
  );
}

/** "Assign to Robin Fairweather", "Assign to you", "Stays with Robin Fairweather" */
function assigneeLine(change: VoiceProposal, meId?: string | null): string | null {
  if (change.type === 'createEpic' || change.type === 'createProject') {
    return null;
  }
  if (change.type === 'delete') {
    return change.before?.assigneeName ? `Assigned to ${change.before.assigneeName}` : null;
  }
  const isMe = !!meId && change.assigneeId === meId;
  const name = isMe ? 'you' : change.assigneeName;
  if (change.type === 'create' || change.type === 'claim') {
    if (change.assigneeId === null) {
      return 'Leave unassigned';
    }
    if (change.assigneeId === undefined && !change.assigneeName) {
      return 'Assign to you';
    }
    return `Assign to ${name ?? 'you'}`;
  }
  if (change.assigneeChanged) {
    if (change.assigneeId === null) {
      return 'Unassign';
    }
    const from = change.before?.assigneeName;
    return `Reassign to ${name}${from ? ` (from ${from})` : ''}`;
  }
  return change.assigneeName ? `Stays with ${change.assigneeName}` : 'Unassigned';
}

function ChangeContext({ change, meId }: { change: VoiceProposal; meId?: string | null }) {
  const action = ACTION[change.type] ?? { label: change.type, color: 'gray' };
  const where =
    change.type === 'createProject'
      ? change.orgName
      : [change.orgName, change.projectName].filter(Boolean).join(' / ');
  const assignee = assigneeLine(change, meId);
  const highlightAssignee =
    change.type === 'claim' || change.assigneeChanged || change.type === 'create';
  const movedFrom =
    change.type === 'update' &&
    change.before?.projectName &&
    change.projectName &&
    change.before.projectName !== change.projectName
      ? change.before.projectName
      : null;

  return (
    <Group gap="sm" wrap="wrap">
      <Badge color={action.color} variant="filled" size="lg">
        {action.label}
      </Badge>
      {where && (
        <Group gap={4} wrap="nowrap">
          <IconFolder size={16} stroke={1.5} />
          <Text size="sm">
            {movedFrom ? `Move from ${movedFrom} to ` : ''}
            {where}
          </Text>
          {change.isNewProject && change.type !== 'createProject' && (
            <Badge size="xs" variant="outline" color="grape">
              new project
            </Badge>
          )}
        </Group>
      )}
      {assignee && (
        <Group gap={4} wrap="nowrap">
          {change.assigneeName && change.assigneeId !== null ? (
            <Avatar size={20} radius="xl" color="blue">
              {change.assigneeName.slice(0, 2).toUpperCase()}
            </Avatar>
          ) : (
            <IconUser size={16} stroke={1.5} />
          )}
          <Text size="sm" fw={highlightAssignee ? 600 : 400}>
            {assignee}
          </Text>
        </Group>
      )}
      {change.epicTitle && (change.type === 'create' || change.type === 'update') && (
        <Group gap={4} wrap="nowrap">
          <IconHierarchy2 size={16} stroke={1.5} />
          <Text size="sm">Epic: {change.epicTitle}</Text>
        </Group>
      )}
    </Group>
  );
}

function ChangeBody({ change }: { change: VoiceProposal }) {
  if (change.type === 'createProject' || change.type === 'createEpic') {
    return (
      <Card withBorder p="md">
        <Stack gap={4}>
          <Text size="sm" fw={700}>
            {change.after?.project}
          </Text>
          {(change.after?.notes || change.after?.reason) && (
            <Text size="xs" c="dimmed">
              {change.after?.notes || change.after?.reason}
            </Text>
          )}
        </Stack>
      </Card>
    );
  }

  if (change.type === 'create' && change.after) {
    return (
      <Card withBorder p="md">
        <TaskSummary task={change.after} />
      </Card>
    );
  }

  if ((change.type === 'delete' || change.type === 'claim') && change.before) {
    return (
      <Card withBorder p="md">
        <TaskSummary
          task={change.before}
          assigneeName={change.before.assigneeName ?? null}
          muted={change.type === 'delete'}
        />
      </Card>
    );
  }

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Stack gap="xs">
          <Text fw={600} size="sm" c="dimmed">
            Now
          </Text>
          <Card withBorder p="md">
            {change.before ? (
              <TaskSummary task={change.before} assigneeName={change.before.assigneeName ?? null} />
            ) : (
              <Text c="dimmed" size="sm">
                Not found
              </Text>
            )}
          </Card>
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Stack gap="xs">
          <Text fw={600} size="sm" c="dimmed">
            After
          </Text>
          <Card withBorder p="md">
            {change.after ? (
              <TaskSummary task={change.after} assigneeName={change.assigneeName ?? null} />
            ) : (
              <Text c="dimmed" size="sm">
                No details
              </Text>
            )}
          </Card>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

/** Older links carried the changes in the URL; keep reading them. */
function readFromUrl(param: string | null): VoiceCommandResult | null {
  if (!param) {
    return null;
  }
  try {
    const proposedChanges = JSON.parse(decodeURIComponent(param)) as VoiceProposal[];
    return { transcript: '', summary: '', proposedChanges };
  } catch {
    return null;
  }
}

function ReviewChangesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [result, setResult] = useState<VoiceCommandResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const counts = useRef({ applied: 0, skipped: 0 });
  const applySession = useRef(newApplySession());
  const finished = useRef(false);

  const loadedOnce = useRef(false);

  useEffect(() => {
    // Load once: the result is a snapshot of one voice command
    if (loadedOnce.current) {
      return;
    }
    loadedOnce.current = true;
    const loaded = loadVoiceReview() ?? readFromUrl(searchParams.get('changes'));
    if (loaded && loaded.proposedChanges?.length) {
      setResult(loaded);
    } else {
      notifications.show({
        title: 'Nothing to review',
        message: 'Record a voice command to suggest some changes.',
        color: 'yellow',
      });
      router.push('/board');
    }
  }, [searchParams, router]);

  const changes = result?.proposedChanges ?? [];
  const currentChange = changes[currentIndex];
  const isLastChange = currentIndex === changes.length - 1;
  const progressPercent = changes.length ? ((currentIndex + 1) / changes.length) * 100 : 0;
  const meId = result?.me?.id ?? null;

  // Warnings that belong to no card: changes that were left out
  const generalWarnings = useMemo(() => {
    const onCards = new Set(changes.flatMap((c) => c.warnings ?? []));
    return (result?.warnings ?? []).filter((w) => !onCards.has(w));
  }, [result, changes]);

  const finish = () => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    clearVoiceReview();
    const { applied, skipped } = counts.current;
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['epics'] });
    queryClient.invalidateQueries({ queryKey: ['organisations'] });
    notifications.show({
      title: 'Review complete',
      message: `Applied ${applied} ${applied === 1 ? 'change' : 'changes'}, skipped ${skipped}.`,
      color: applied > 0 ? 'green' : 'gray',
    });
    router.push('/board');
  };

  const next = () => {
    setLastError(null);
    if (isLastChange) {
      finish();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleApply = async () => {
    if (!currentChange) {
      return;
    }
    if (!session?.accessToken) {
      notifications.show({
        title: 'Not signed in',
        message: 'Sign in and try again.',
        color: 'red',
      });
      return;
    }
    setIsProcessing(true);
    setLastError(null);
    try {
      const outcome = await applyVoiceChange(
        currentChange,
        session.accessToken,
        applySession.current,
        meId
      );
      counts.current.applied += 1;
      notifications.show({ message: outcome.message, color: 'green' });
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't apply this change.";
      const status = error instanceof VoiceApplyError ? error.status : 0;
      setLastError(message);
      notifications.show({
        title:
          status === 403
            ? 'Not allowed'
            : status === 404
              ? 'Not found'
              : "Couldn't apply this change",
        message,
        color: 'red',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    counts.current.skipped += 1;
    next();
  };

  if (!currentChange) {
    return (
      <Container py="xl">
        <Loader />
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Box>
          <Title order={2}>Review voice changes</Title>
          <Text c="dimmed" size="sm">
            Change {currentIndex + 1} of {changes.length}
          </Text>
        </Box>

        <Progress value={progressPercent} size="sm" />

        {(result?.transcript || result?.summary) && (
          <Card withBorder p="sm" bg="var(--mantine-color-default-hover)">
            <Stack gap={4}>
              {result?.transcript && (
                <Group gap={6} wrap="nowrap" align="flex-start">
                  <IconMicrophone size={16} stroke={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
                  <Text size="sm" fs="italic">
                    &ldquo;{result.transcript.trim()}&rdquo;
                  </Text>
                </Group>
              )}
              {result?.summary && (
                <Text size="sm" c="dimmed">
                  {result.summary}
                </Text>
              )}
              {result?.answer && <Text size="sm">{result.answer}</Text>}
            </Stack>
          </Card>
        )}

        {generalWarnings.length > 0 && (
          <Alert
            color="yellow"
            variant="light"
            icon={<IconAlertTriangle size={18} />}
            title={
              generalWarnings.length === 1 ? 'One thing was left out' : 'Some things were left out'
            }
          >
            <List size="sm" spacing={2}>
              {generalWarnings.map((w) => (
                <List.Item key={w}>{w}</List.Item>
              ))}
            </List>
          </Alert>
        )}

        <Card withBorder p="lg" radius="md">
          <Stack gap="md">
            <ChangeContext change={currentChange} meId={meId} />

            {(currentChange.warnings?.length ?? 0) > 0 && (
              <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} p="xs">
                <Stack gap={2}>
                  {currentChange.warnings!.map((w) => (
                    <Text key={w} size="sm">
                      {w}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}

            <ChangeBody change={currentChange} />

            {lastError && (
              <Text size="sm" c="red">
                {lastError}
              </Text>
            )}
          </Stack>
        </Card>

        <Group justify="space-between">
          <Button variant="subtle" color="gray" onClick={handleSkip} disabled={isProcessing}>
            Skip
          </Button>
          <Button
            onClick={handleApply}
            loading={isProcessing}
            color={currentChange.type === 'delete' ? 'red' : undefined}
          >
            {isLastChange ? 'Apply and finish' : 'Apply and next'}
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}

export default function ReviewChangesPage() {
  return (
    <Suspense
      fallback={
        <Container py="xl">
          <Loader />
        </Container>
      }
    >
      <ReviewChangesContent />
    </Suspense>
  );
}
