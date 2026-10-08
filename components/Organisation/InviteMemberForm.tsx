'use client';

import React, { useState } from 'react';
import { IconMailPlus } from '@tabler/icons-react';
import { Button, Group, Select, TextInput } from '@mantine/core';

export interface InviteMemberFormProps {
  initialEmail?: string;
  onInvite: (email: string, role: 'admin' | 'member') => Promise<void>;
  isLoading?: boolean;
}

export function InviteMemberForm({
  initialEmail = '',
  onInvite,
  isLoading = false,
}: InviteMemberFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState<'admin' | 'member'>('member');

  React.useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      return;
    }
    await onInvite(email.trim(), role);
    setEmail('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <Group align="flex-end" gap="sm">
        <TextInput
          label="Email Address"
          placeholder="colleague@example.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          type="email"
          style={{ flex: 2 }}
          data-testid="invite-email-input"
        />
        <Select
          label="Role"
          value={role}
          onChange={(val) => setRole((val as 'admin' | 'member') || 'member')}
          data={[
            { value: 'member', label: 'Member' },
            { value: 'admin', label: 'Admin' },
          ]}
          style={{ flex: 1 }}
          data-testid="invite-role-select"
        />
        <Button
          type="submit"
          leftSection={<IconMailPlus size={16} />}
          loading={isLoading}
          disabled={!email.trim() || !email.includes('@')}
          data-testid="invite-submit-btn"
        >
          Send Invite
        </Button>
      </Group>
    </form>
  );
}
