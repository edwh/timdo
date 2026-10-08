'use client';

import React from 'react';
import { Tooltip } from '@mantine/core';
import { VIEW_ONLY_LABEL } from './teamFormat';

interface ViewOnlyTooltipProps {
  /** When false the children render untouched */
  viewOnly: boolean;
  label?: string;
  children: React.ReactNode;
}

/**
 * Wraps a disabled control so its "View only" tooltip still shows. Disabled buttons swallow
 * mouse events, so the tooltip hangs off an inline wrapper instead.
 */
export function ViewOnlyTooltip({
  viewOnly,
  label = VIEW_ONLY_LABEL,
  children,
}: ViewOnlyTooltipProps) {
  if (!viewOnly) {
    return <>{children}</>;
  }
  return (
    <Tooltip label={label} withArrow>
      <span style={{ display: 'inline-flex' }} data-testid="view-only-wrapper">
        {children}
      </span>
    </Tooltip>
  );
}
