import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { useMergeProjects } from '../../app/hooks/useProjectMutations';
import type { Project } from '../../app/types/project.types';
import { theme } from '../../theme';
import { MergeTaskModal } from './MergeTaskModal';

jest.mock('../../app/hooks/useProjectMutations', () => ({
  useMergeProjects: jest.fn(),
}));

const mockCurrentTask: Project = {
  id: 'current-1234-uuid',
  userId: 'user-1',
  project: 'Target Current Task',
  status: 'do',
  priority: 7,
  size: '***',
  notes: 'Current task notes',
  isDeleted: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const mockOtherTask: Project = {
  id: 'other-5678-uuid',
  userId: 'user-1',
  project: 'Source Other Task',
  status: 'delay',
  priority: 9,
  size: '****',
  notes: 'Other task notes',
  isDeleted: false,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const mockDeletedTask: Project = {
  id: 'deleted-9999-uuid',
  userId: 'user-1',
  project: 'Deleted Task',
  status: 'done',
  priority: 3,
  size: '*',
  isDeleted: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('MergeTaskModal', () => {
  let mockMutateAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync = jest.fn().mockResolvedValue({});
    (useMergeProjects as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  const renderComponent = (
    props: {
      opened?: boolean;
      onClose?: () => void;
      currentTask?: Project;
      allTasks?: Project[];
    } = {}
  ) => {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme}>
          <MergeTaskModal
            opened={props.opened ?? true}
            onClose={props.onClose ?? jest.fn()}
            currentTask={props.currentTask ?? mockCurrentTask}
            allTasks={props.allTasks ?? [mockCurrentTask, mockOtherTask, mockDeletedTask]}
          />
        </MantineProvider>
      </QueryClientProvider>
    );
  };

  it('renders modal title and disabled Confirm button when no other task selected', () => {
    renderComponent();

    expect(screen.getByText('Merge Tasks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm & merge/i })).toBeDisabled();
  });

  it('allows selecting another task and renders merge outcome preview', async () => {
    const user = userEvent.setup();
    const handleClose = jest.fn();

    renderComponent({ onClose: handleClose });

    // Find the select input
    const select = screen.getByRole('textbox', { name: /select the other task to merge with/i });
    await user.click(select);

    // Option should be visible
    const option = await screen.findByRole('option', {
      name: new RegExp(mockOtherTask.project, 'i'),
    });
    await user.click(option);

    // Preview should now appear
    expect(screen.getByText('Preview Merge Outcome')).toBeInTheDocument();
    expect(screen.getByText('KEEPING (Surviving Task)')).toBeInTheDocument();
    expect(screen.getByText('ABSORBING (Will Be Archived)')).toBeInTheDocument();

    // Confirm button enabled
    const confirmBtn = screen.getByRole('button', { name: /confirm & merge/i });
    expect(confirmBtn).toBeEnabled();

    // Click Confirm & Merge
    await user.click(confirmBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      targetId: mockCurrentTask.id,
      sourceId: mockOtherTask.id,
    });
    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('handles reversing merge direction', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Select the other task
    const select = screen.getByRole('textbox', { name: /select the other task to merge with/i });
    await user.click(select);
    const option = await screen.findByRole('option', {
      name: new RegExp(mockOtherTask.project, 'i'),
    });
    await user.click(option);

    // Switch direction: "Merge this task into another"
    const reverseRadio = screen.getByLabelText('Merge this task into another');
    await user.click(reverseRadio);

    // Click Confirm & Merge
    const confirmBtn = screen.getByRole('button', { name: /confirm & merge/i });
    await user.click(confirmBtn);

    // Now mockOtherTask is surviving (target) and mockCurrentTask is source
    expect(mockMutateAsync).toHaveBeenCalledWith({
      targetId: mockOtherTask.id,
      sourceId: mockCurrentTask.id,
    });
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = jest.fn();
    renderComponent({ onClose: handleClose });

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
