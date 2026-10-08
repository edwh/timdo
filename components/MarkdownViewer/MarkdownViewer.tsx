'use client';

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Box, TypographyStylesProvider } from '@mantine/core';

// Configure marked with sensible defaults
marked.setOptions({
  gfm: true,
  breaks: true,
});

interface MarkdownViewerProps {
  content?: string | null;
  emptyText?: string;
  className?: string;
}

export function MarkdownViewer({
  content,
  emptyText = 'No description provided.',
  className,
}: MarkdownViewerProps) {
  const sanitizedHtml = useMemo(() => {
    if (!content || !content.trim()) {
      return null;
    }
    const rawHtml = marked.parse(content) as string;
    // DOMPurify is safe in browser environments. For SSR or Edge fallback, sanitize.
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(rawHtml);
    }
    return rawHtml;
  }, [content]);

  if (!sanitizedHtml) {
    return (
      <Box c="dimmed" fs="italic" className={className}>
        {emptyText}
      </Box>
    );
  }

  return (
    <TypographyStylesProvider className={className}>
      <div
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        style={{
          wordBreak: 'break-word',
          lineHeight: 1.6,
        }}
      />
    </TypographyStylesProvider>
  );
}
