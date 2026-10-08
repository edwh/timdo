'use client';

import React from 'react';
import { Avatar, type AvatarProps } from '@mantine/core';
import { avatarColour, initials } from './activityFormat';

export interface PersonAvatarProps extends Omit<AvatarProps, 'children' | 'color' | 'name'> {
  /** Display name, falls back to the email */
  name?: string | null;
  email?: string | null;
  /** Stable id used to pick the colour */
  seed?: string | null;
}

/** Round avatar with initials and a colour that stays the same for each person. */
export function PersonAvatar({ name, email, seed, size = 'md', ...rest }: PersonAvatarProps) {
  const label = name || email || 'Unknown person';
  return (
    <Avatar
      size={size}
      radius="xl"
      color={avatarColour(seed || email || name)}
      variant="light"
      aria-hidden
      title={label}
      {...rest}
    >
      {initials(name || email)}
    </Avatar>
  );
}
