'use client';

import { Container, Loader, Stack, Text } from '@mantine/core';

export function OnboardingProcessing() {
  return (
    <Container size="sm" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Stack gap="xl" align="center" style={{ width: '100%' }}>
        <Loader size="xl" />
        <Text size="xl" fw={500}>
          Processing your projects...
        </Text>
      </Stack>
    </Container>
  );
}
