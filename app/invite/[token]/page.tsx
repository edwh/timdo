'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IconAlertTriangle, IconCircleCheck, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../../components/Sharing/sharingRules';
import { SignInPrompt } from '../../../components/Sharing/SignInPrompt';
import { useAcceptInvite } from '../../hooks/useSharingQueries';
import { fetchWorkspaces } from '../../lib/collaborationApi';

// Dynamic route: Cloudflare Pages (next-on-pages) needs the edge runtime
export const runtime = 'edge';

type FailureKind = 'expired' | 'used' | 'other';

function failureKind(message: string): FailureKind {
  const m = message.toLowerCase();
  if (m.includes('expired')) {
    return 'expired';
  }
  if (m.includes('invalid') || m.includes('already been used') || m.includes('already used')) {
    return 'used';
  }
  return 'other';
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Container size="xs" py="xl">
      <Card withBorder radius="md" padding="xl" shadow="xs">
        <Stack align="center" gap="sm" ta="center">
          {children}
        </Stack>
      </Card>
    </Container>
  );
}

function Actions() {
  return (
    <Group justify="center" gap="sm" mt="xs">
      <Button component={Link} href="/">
        Go to your tasks
      </Button>
      <Button component={Link} href="/sharing" variant="default">
        See sharing
      </Button>
    </Group>
  );
}

export default function InvitePage() {
  const params = useParams();
  const raw = params?.token;
  const inviteToken = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  const { data: session, status } = useSession();
  const accept = useAcceptInvite();
  const attempted = useRef(false);

  // Accept once, as soon as we know who is signed in
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken && inviteToken && !attempted.current) {
      attempted.current = true;
      accept.mutate(inviteToken);
    }
  }, [status, session?.accessToken, inviteToken, accept]);

  const { data: workspaces } = useQuery({
    queryKey: ['organisations', 'list'],
    queryFn: () => fetchWorkspaces(session?.accessToken),
    enabled: !!session?.accessToken && (accept.isSuccess || accept.isError),
  });

  if (status === 'unauthenticated') {
    return (
      <Container size="xs" py="xl">
        <SignInPrompt
          title="You've been invited to TimDo"
          message="Someone has shared a workspace with you. Sign in with the email address the invite was sent to and you'll join straight away."
        />
      </Container>
    );
  }

  if (!inviteToken) {
    return (
      <Shell>
        <Title order={2} size="h3">
          This invite link is incomplete
        </Title>
        <Text c="dimmed" size="sm">
          Check you copied the whole link, or ask for a new one.
        </Text>
        <Actions />
      </Shell>
    );
  }

  if (accept.isSuccess) {
    const joined = (Array.isArray(workspaces) ? workspaces : []).find(
      (w) => w.id === accept.data.orgId
    );
    const role = accept.data.role;
    return (
      <Shell>
        <ThemeIcon size={56} radius="xl" color="teal" variant="light" aria-hidden>
          <IconCircleCheck size={32} />
        </ThemeIcon>
        <Title order={2} size="h3" data-testid="invite-success">
          {joined ? `You've joined ${joined.name}` : "You've joined the workspace"}
        </Title>
        {role && ROLE_LABELS[role] && (
          <Text c="dimmed" size="sm">
            You&apos;re a {ROLE_LABELS[role].toLowerCase()}: {ROLE_DESCRIPTIONS[role].toLowerCase()}
            . You can now see all of its projects, epics and tasks.
          </Text>
        )}
        <Actions />
      </Shell>
    );
  }

  if (accept.isError) {
    const message = accept.error?.message || '';
    const kind = failureKind(message);
    const shared = (Array.isArray(workspaces) ? workspaces : []).filter((w) => !w.isPersonal);

    if (kind === 'used' && shared.length > 0) {
      // Signing in claims invites sent to your email, so the link may already have done its job
      return (
        <Shell>
          <ThemeIcon size={56} radius="xl" color="blue" variant="light" aria-hidden>
            <IconUsers size={30} />
          </ThemeIcon>
          <Title order={2} size="h3">
            This invite has already been used
          </Title>
          <Text c="dimmed" size="sm">
            If it was sent to you, you joined when you signed in. You&apos;re in{' '}
            {shared.map((w) => w.name).join(', ')}.
          </Text>
          <Actions />
        </Shell>
      );
    }

    return (
      <Shell>
        <ThemeIcon size={56} radius="xl" color="orange" variant="light" aria-hidden>
          <IconAlertTriangle size={30} />
        </ThemeIcon>
        <Title order={2} size="h3" data-testid="invite-error">
          {kind === 'expired'
            ? 'This invite has expired'
            : kind === 'used'
              ? "This invite link doesn't work"
              : "We couldn't accept this invite"}
        </Title>
        <Text c="dimmed" size="sm">
          {kind === 'expired'
            ? 'Invites last 30 days. Ask whoever shared it with you to send a new one.'
            : kind === 'used'
              ? 'It may have been cancelled or already used. Ask whoever shared it with you for a new link.'
              : message || 'Something went wrong. Please try again.'}
        </Text>
        <Actions />
      </Shell>
    );
  }

  return (
    <Shell>
      <Loader role="status" aria-label="Joining workspace" />
      <Text c="dimmed" size="sm">
        {status === 'loading' ? 'Checking you are signed in…' : 'Joining the workspace…'}
      </Text>
    </Shell>
  );
}
