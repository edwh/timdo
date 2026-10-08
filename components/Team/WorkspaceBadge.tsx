'use client';

import React from 'react';
import { IconUser, IconUsers } from '@tabler/icons-react';
import { Badge, Tooltip, type BadgeProps } from '@mantine/core';
import { joinNames, workspaceLabel } from './teamFormat';

export interface WorkspaceBadgeProps extends Omit<BadgeProps, 'children' | 'leftSection'> {
  name?: string | null;
  isPersonal?: boolean | null;
  /** True when the workspace has more than one member */
  isShared?: boolean | null;
  /** Other members' names, for the "Shared with ..." tooltip */
  sharedWith?: string[];
}

/**
 * Shows which workspace something lives in. Personal shows as "Personal"; shared workspaces get
 * a people icon and a "Shared with ..." tooltip.
 */
export function WorkspaceBadge({
  name,
  isPersonal,
  isShared,
  sharedWith = [],
  size = 'xs',
  variant = 'light',
  ...rest
}: WorkspaceBadgeProps) {
  const label = workspaceLabel({ name, isPersonal });
  const shared = !!isShared && !isPersonal;
  const people = joinNames(sharedWith, 3);
  const tooltip = shared
    ? people
      ? `${label} workspace, shared with ${people}`
      : `${label} workspace, shared`
    : 'Your personal workspace';

  return (
    <Tooltip label={tooltip} withArrow openDelay={200}>
      <Badge
        size={size}
        variant={variant}
        color={shared ? 'grape' : 'gray'}
        leftSection={shared ? <IconUsers size={10} /> : <IconUser size={10} />}
        style={{ textTransform: 'none' }}
        {...rest}
      >
        {label}
      </Badge>
    </Tooltip>
  );
}
