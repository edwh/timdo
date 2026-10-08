'use client';

import React from 'react';
import { Button, Group, Modal, Stack } from '@mantine/core';

export interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  /** Red button for anything that takes access away */
  danger?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  danger = false,
  loading = false,
  confirmDisabled = false,
}: ConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered radius="md">
      <Stack gap="md">
        {children}
        <Group justify="flex-end" gap="sm">
          <Button
            variant="default"
            onClick={onClose}
            disabled={loading}
            data-autofocus={danger || undefined}
          >
            Cancel
          </Button>
          <Button
            color={danger ? 'red' : undefined}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
            data-autofocus={!danger || undefined}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
