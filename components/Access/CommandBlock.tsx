'use client';

import React from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { ActionIcon, Box, Code, CopyButton, Tooltip } from '@mantine/core';

/** A command (or secret) in a monospace block with a copy button in the corner. */
export function CommandBlock({
  value,
  copyLabel = 'Copy command',
  testId,
  withCopy = true,
}: {
  value: string;
  /** Tooltip and accessible name for the copy button */
  copyLabel?: string;
  testId?: string;
  /** Leave out the corner button when a labelled copy button sits nearby */
  withCopy?: boolean;
}) {
  return (
    <Box pos="relative">
      <Code
        block
        data-testid={testId}
        pr={withCopy ? 44 : undefined}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13 }}
      >
        {value}
      </Code>
      {withCopy && (
        <CopyButton value={value} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : copyLabel} withArrow position="left">
              <ActionIcon
                variant="subtle"
                color={copied ? 'teal' : 'gray'}
                onClick={copy}
                aria-label={copyLabel}
                pos="absolute"
                top={6}
                right={6}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      )}
    </Box>
  );
}
