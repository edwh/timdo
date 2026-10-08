'use client';

import React, { useState } from 'react';
import { IconCode, IconEye } from '@tabler/icons-react';
import { Box, Paper, SegmentedControl, Textarea } from '@mantine/core';
import { MarkdownViewer } from './MarkdownViewer';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  label?: string;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
}

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  label = 'Task Description (Markdown)',
  placeholder = 'Write long-form description, context, checklists (- [ ]), links, notes...',
  minRows = 6,
  maxRows = 25,
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <Box>
      <Box
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 'var(--mantine-font-size-sm)', fontWeight: 500 }}>{label}</span>
        <SegmentedControl
          size="xs"
          value={tab}
          onChange={(val) => setTab(val as 'write' | 'preview')}
          data={[
            {
              value: 'write',
              label: (
                <Box style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconCode size={13} />
                  <span>Write</span>
                </Box>
              ),
            },
            {
              value: 'preview',
              label: (
                <Box style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconEye size={13} />
                  <span>Preview</span>
                </Box>
              ),
            },
          ]}
        />
      </Box>

      {tab === 'write' ? (
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          onBlur={onBlur}
          autosize
          minRows={minRows}
          maxRows={maxRows}
          styles={{
            input: {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: '0.9rem',
              lineHeight: 1.5,
            },
          }}
        />
      ) : (
        <Paper
          p="md"
          withBorder
          radius="sm"
          style={{
            minHeight: minRows * 24,
            maxHeight: maxRows * 24,
            overflowY: 'auto',
            backgroundColor: 'var(--mantine-color-default)',
          }}
        >
          <MarkdownViewer content={value} emptyText="Nothing to preview yet." />
        </Paper>
      )}
    </Box>
  );
}
