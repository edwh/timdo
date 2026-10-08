'use client';

import React, { useEffect, useState } from 'react';
import { IconSearch, IconUser, IconUserPlus } from '@tabler/icons-react';
import {
  Avatar,
  Badge,
  Box,
  Combobox,
  Group,
  Loader,
  Text,
  TextInput,
  useCombobox,
} from '@mantine/core';
import { useSearchUsers } from '../../app/hooks/useOrganisationQueries';
import type { AutocompleteUserResult } from '../../app/types/organisation.types';

export interface MemberAutocompleteProps {
  orgId: string;
  onSelectExistingUser: (user: AutocompleteUserResult) => void;
  onSelectInviteEmail: (email: string) => void;
  disabled?: boolean;
}

export function MemberAutocomplete({
  orgId,
  onSelectExistingUser,
  onSelectInviteEmail,
  disabled = false,
}: MemberAutocompleteProps) {
  const [value, setValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [value]);

  const { data: searchResults = [], isLoading } = useSearchUsers(orgId, debouncedQuery);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isQueryEmail = isValidEmail(value.trim());
  const exactMatchExists = searchResults.some(
    (u) => u.email.toLowerCase() === value.trim().toLowerCase()
  );

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val.startsWith('invite:')) {
          const email = val.replace('invite:', '');
          onSelectInviteEmail(email);
          setValue('');
        } else {
          const matchedUser = searchResults.find((u) => u.id === val);
          if (matchedUser) {
            onSelectExistingUser(matchedUser);
            setValue('');
          }
        }
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <TextInput
          placeholder="Search user by name/email or enter new email..."
          value={value}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            combobox.openDropdown();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          leftSection={<IconSearch size={16} />}
          rightSection={isLoading ? <Loader size={16} /> : null}
          disabled={disabled}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {searchResults.length > 0 &&
            searchResults.map((user) => (
              <Combobox.Option
                key={user.id}
                value={user.id}
                disabled={user.isMember}
                data-testid={`user-option-${user.id}`}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm">
                    <Avatar size="sm" radius="xl" color="blue">
                      <IconUser size={14} />
                    </Avatar>
                    <Box>
                      <Text size="sm" fw={500}>
                        {user.name || 'Unnamed User'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {user.email}
                      </Text>
                    </Box>
                  </Group>
                  {user.isMember ? (
                    <Badge size="xs" color="gray" variant="light">
                      Already Member ({user.role})
                    </Badge>
                  ) : (
                    <Badge size="xs" color="green" variant="light">
                      Add to Org
                    </Badge>
                  )}
                </Group>
              </Combobox.Option>
            ))}

          {/* Email invitation fallback */}
          {value.trim().length > 0 && !exactMatchExists && (
            <Combobox.Option value={`invite:${value.trim()}`} data-testid="invite-email-option">
              <Group gap="sm">
                <Avatar size="sm" radius="xl" color="orange">
                  <IconUserPlus size={14} />
                </Avatar>
                <Box>
                  <Text size="sm" fw={500}>
                    Invite{' '}
                    <Text span fw={700}>
                      {value.trim()}
                    </Text>
                  </Text>
                  <Text size="xs" c="dimmed">
                    {isQueryEmail
                      ? 'Send invitation link to TimDo & Organisation via email'
                      : 'Enter a valid email to invite to organisation'}
                  </Text>
                </Box>
              </Group>
            </Combobox.Option>
          )}

          {value.trim().length > 0 &&
            searchResults.length === 0 &&
            !isLoading &&
            !value.trim().includes('@') && (
              <Combobox.Empty>No users found. Type full email to invite.</Combobox.Empty>
            )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
