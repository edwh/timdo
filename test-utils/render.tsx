import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as testingLibraryRender } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { theme } from '../theme';

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const defaultMockSession = {
  user: {
    name: 'Test User',
    email: 'test@example.com',
    id: 'test-user-id',
  },
  expires: '1',
  accessToken: 'test-access-token',
};

// A custom render function that wraps components in all necessary providers.
// It now accepts an optional session object to override the default.
export function render(
  ui: React.ReactNode,
  { session = defaultMockSession }: { session?: typeof defaultMockSession | null } = {}
) {
  const testQueryClient = createTestQueryClient();
  return testingLibraryRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={testQueryClient}>
        <MantineProvider theme={theme}>{children}</MantineProvider>
      </QueryClientProvider>
    ),
  });
}

// A specific wrapper for tests that need to control the QueryClient instance
export const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const testQueryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={testQueryClient}>
      <MantineProvider theme={theme}>{children}</MantineProvider>
    </QueryClientProvider>
  );
};
