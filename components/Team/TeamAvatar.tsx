'use client';

import React from 'react';
import { Avatar, Tooltip, type AvatarProps } from '@mantine/core';
import { avatarColour, initials } from './teamFormat';

export interface TeamAvatarProps extends Omit<AvatarProps, 'children' | 'color' | 'name'> {
  /** Display name, falls back to the email */
  name?: string | null;
  email?: string | null;
  /** Stable id used to pick the colour */
  seed?: string | null;
  /** Tooltip text, e.g. "Assigned to Robin Fairweather". Omit for no tooltip. */
  tooltip?: string;
}

/** Small round avatar with initials, a stable colour per person and an optional tooltip. */
export function TeamAvatar({ name, email, seed, tooltip, size = 22, ...rest }: TeamAvatarProps) {
  const avatar = (
    <Avatar
      size={size}
      radius="xl"
      color={avatarColour(seed || email || name)}
      variant="light"
      aria-label={tooltip || name || email || 'Unknown person'}
      role="img"
      {...rest}
    >
      {initials(name || email)}
    </Avatar>
  );

  if (!tooltip) {
    return avatar;
  }

  return (
    <Tooltip label={tooltip} withArrow openDelay={200}>
      {avatar}
    </Tooltip>
  );
}
