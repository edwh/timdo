'use client';

import React from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { Button, Group } from '@mantine/core';

export function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <Group>
        <Button onClick={() => signOut()}>Sign Out</Button>
      </Group>
    );
  }

  return (
    <Group>
      <Button onClick={() => signIn('auth0')}>Sign In</Button>
    </Group>
  );
}
