'use client';

import React from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { ActionIcon, Button, CopyButton, Tooltip } from '@mantine/core';

/** Copy an invite link, as a small icon or a labelled button. */
export function CopyLinkButton({
  value,
  label = 'Copy link',
  iconOnly = false,
}: {
  value: string;
  label?: string;
  iconOnly?: boolean;
}) {
  return (
    <CopyButton value={value} timeout={2000}>
      {({ copied, copy }) =>
        iconOnly ? (
          <Tooltip label={copied ? 'Copied' : label} withArrow>
            <ActionIcon
              variant="subtle"
              color={copied ? 'teal' : 'gray'}
              onClick={copy}
              aria-label={label}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        ) : (
          <Button
            size="xs"
            variant="light"
            color={copied ? 'teal' : undefined}
            leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            onClick={copy}
          >
            {copied ? 'Copied' : label}
          </Button>
        )
      }
    </CopyButton>
  );
}
