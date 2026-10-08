'use client';

import React, { useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { Button, Group, TextInput } from '@mantine/core';
import { useCreateApiToken, type CreatedApiToken } from '../../app/hooks/useApiTokens';

export function CreateTokenForm({ onCreated }: { onCreated: (created: CreatedApiToken) => void }) {
  const [name, setName] = useState('');
  const create = useCreateApiToken();
  const trimmed = name.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed || create.isPending) {
          return;
        }
        create.mutate(trimmed, {
          onSuccess: (created) => {
            setName('');
            onCreated(created);
            // Don't leave the secret in the mutation cache
            create.reset();
          },
        });
      }}
    >
      <Group align="flex-end" gap="sm" wrap="wrap">
        <TextInput
          label="New token"
          description="Name it after where you'll use it, so you know which one to revoke later."
          placeholder="e.g. Laptop CLI"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          maxLength={60}
          style={{ flex: '1 1 240px' }}
          data-testid="token-name-input"
        />
        <Button
          type="submit"
          leftSection={<IconPlus size={16} />}
          loading={create.isPending}
          disabled={!trimmed}
        >
          Create token
        </Button>
      </Group>
    </form>
  );
}
