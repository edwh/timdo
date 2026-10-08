'use client';

import React, { useEffect, useState } from 'react';
import {
  IconCheck,
  IconInfoCircle,
  IconMailForward,
  IconSearch,
  IconShare,
} from '@tabler/icons-react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Combobox,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  useCombobox,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { usePeopleSearch, useSharePerson } from '../../app/hooks/useSharingQueries';
import { inviteLink } from '../../app/lib/collaborationApi';
import type {
  InviteResult,
  InviteRole,
  SharingWorkspace,
  WorkspaceRole,
} from '../../app/types/collaboration.types';
import { PersonAvatar } from '../Activity/PersonAvatar';
import { CopyLinkButton } from './CopyLinkButton';
import { inviteRoles, ROLE_DESCRIPTIONS, ROLE_LABELS, workspaceLabel } from './sharingRules';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useDebounced(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

export function ShareResult({
  result,
  workspaceName,
  onClose,
}: {
  result: InviteResult;
  workspaceName: string;
  onClose: () => void;
}) {
  if (result.status === 'added') {
    return (
      <Alert
        color="green"
        variant="light"
        icon={<IconCheck size={18} />}
        withCloseButton
        onClose={onClose}
        closeButtonLabel="Dismiss"
        data-testid="share-result-added"
      >
        {result.name || result.email} can now see {workspaceName}.
      </Alert>
    );
  }
  if (result.status === 'already_member') {
    return (
      <Alert
        color="blue"
        variant="light"
        icon={<IconInfoCircle size={18} />}
        withCloseButton
        onClose={onClose}
        closeButtonLabel="Dismiss"
        data-testid="share-result-already"
      >
        {result.email} is already in {workspaceName} as {ROLE_LABELS[result.role].toLowerCase()}.
        Change their role in the list above if you need to.
      </Alert>
    );
  }
  const link = inviteLink(result.token);
  return (
    <Alert
      color="orange"
      variant="light"
      icon={<IconMailForward size={18} />}
      title={`Invite ready for ${result.email}`}
      withCloseButton
      onClose={onClose}
      closeButtonLabel="Dismiss"
      data-testid="share-result-invited"
    >
      <Stack gap="xs">
        <Text size="sm">
          They don&apos;t have a TimDo account yet. They&apos;ll join {workspaceName} automatically
          when they sign in with {result.email}. TimDo doesn&apos;t email them, so send them this
          link:
        </Text>
        <Group gap="xs" wrap="nowrap" align="center">
          <Code
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            data-testid="invite-link"
          >
            {link}
          </Code>
          <CopyLinkButton value={link} />
        </Group>
      </Stack>
    </Alert>
  );
}

export function AddPeopleForm({ workspace }: { workspace: SharingWorkspace }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const debounced = useDebounced(query);
  const label = workspaceLabel(workspace);

  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const { data: matches = [], isFetching } = usePeopleSearch(workspace.id, debounced);
  const share = useSharePerson(workspace.id);
  const roles = inviteRoles(workspace.role);
  const showDropdown = debounced.trim().length >= 2 && matches.length > 0;

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const email = query.trim();
    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter an email address, or pick someone from the list');
      return;
    }
    setError(null);
    setResult(null);
    share.mutate(
      { email, role },
      {
        onSuccess: (res) => {
          setResult(res);
          if (res.status !== 'already_member') {
            setQuery('');
          }
          if (res.status === 'added') {
            notifications.show({
              title: 'Shared',
              message: `${res.name || res.email} can now see ${label}`,
              color: 'green',
            });
          }
        },
      }
    );
  };

  return (
    <Box>
      <Text fw={600} size="sm" mb="xs">
        Add people
      </Text>
      {workspace.isPersonal && (
        <Text size="xs" c="dimmed" mb="xs">
          Sharing your personal workspace shares every project in it. To share just some, move them
          to a shared workspace.
        </Text>
      )}
      <form onSubmit={submit} noValidate>
        <Group align="flex-start" gap="xs" wrap="wrap">
          <Combobox
            store={combobox}
            onOptionSubmit={(value) => {
              setQuery(value);
              setError(null);
              combobox.closeDropdown();
            }}
            withinPortal
          >
            <Combobox.Target>
              <TextInput
                style={{ flex: '1 1 240px' }}
                aria-label="Email or name"
                placeholder="Email or name"
                type="email"
                autoComplete="off"
                value={query}
                error={error}
                leftSection={<IconSearch size={16} />}
                rightSection={isFetching ? <Loader size={14} /> : null}
                onChange={(e) => {
                  setQuery(e.currentTarget.value);
                  setError(null);
                  combobox.openDropdown();
                  combobox.updateSelectedOptionIndex();
                }}
                onFocus={() => combobox.openDropdown()}
                onBlur={() => combobox.closeDropdown()}
                data-testid="share-email-input"
              />
            </Combobox.Target>
            <Combobox.Dropdown hidden={!showDropdown}>
              <Combobox.Options>
                {matches.map((person) => (
                  <Combobox.Option
                    key={person.id}
                    value={person.email}
                    disabled={person.isMember}
                    data-testid={`person-option-${person.id}`}
                  >
                    <Group gap="sm" wrap="nowrap" justify="space-between">
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <PersonAvatar
                          size="sm"
                          name={person.name}
                          email={person.email}
                          seed={person.id}
                        />
                        <Box style={{ minWidth: 0 }}>
                          <Text size="sm" truncate>
                            {person.name || person.email}
                          </Text>
                          {person.name && (
                            <Text size="xs" c="dimmed" truncate>
                              {person.email}
                            </Text>
                          )}
                        </Box>
                      </Group>
                      {person.isMember && (
                        <Badge size="xs" variant="light" color="gray">
                          Already here
                        </Badge>
                      )}
                    </Group>
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            </Combobox.Dropdown>
          </Combobox>

          <Select
            w={130}
            aria-label="Role"
            value={role}
            allowDeselect={false}
            onChange={(value) => value && setRole(value as InviteRole)}
            data={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            renderOption={({ option }) => (
              <Box>
                <Text size="sm">{option.label}</Text>
                <Text size="xs" c="dimmed">
                  {ROLE_DESCRIPTIONS[option.value as WorkspaceRole]}
                </Text>
              </Box>
            )}
            comboboxProps={{ width: 220, position: 'bottom-end' }}
            data-testid="share-role-select"
          />

          <Button
            type="submit"
            leftSection={<IconShare size={16} />}
            loading={share.isPending}
            disabled={!query.trim()}
          >
            Share
          </Button>
        </Group>
      </form>

      {result && (
        <Box mt="sm">
          <ShareResult result={result} workspaceName={label} onClose={() => setResult(null)} />
        </Box>
      )}
    </Box>
  );
}
