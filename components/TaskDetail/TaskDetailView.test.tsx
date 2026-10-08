import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import * as orgQueries from '../../app/hooks/useOrganisationQueries';
import * as projectMutations from '../../app/hooks/useProjectMutations';
import * as taskMutations from '../../app/hooks/useTaskMutations';
import type { Project } from '../../app/types/project.types';
import { theme } from '../../theme';
import { TaskDetailView } from './TaskDetailView';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock hooks
jest.mock('../../app/hooks/useOrganisationQueries');
jest.mock('../../app/hooks/useTaskMutations');
jest.mock('../../app/hooks/useProjectMutations');
jest.mock('../../app/hooks/useProjectQueries', () => ({
  useProjects: () => ({ data: [] }),
}));
jest.mock('../../app/hooks/useEpicQueries', () => ({
  useEpics: () => ({ data: [{ id: 'epic-1', title: 'Epic 1', category: 'Solfit' }] }),
}));
jest.mock('../../app/hooks/useGoalQueries', () => ({
  useGoals: () => ({ data: [{ id: 'goal-1', title: 'Learn Rust', type: 'focus' }] }),
}));
jest.mock('../../app/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'user-1', name: 'Alice Smith', email: 'alice@solfit.com' },
    userId: 'user-1',
    isMe: (id?: string | null) => id === 'user-1',
  }),
}));
jest.mock('../../app/hooks/useWorkspaces', () => ({
  useWorkspaceLookup: () => (orgId: string | null) =>
    orgId === 'org-1'
      ? { label: 'Solfit Org', isPersonal: false }
      : { label: 'Personal', isPersonal: true },
  useWorkspaceProjects: () => ({
    editableProjectGroups: [
      { group: 'Solfit Org (shared)', items: [{ value: 'proj-solfit', label: 'Solfit' }] },
    ],
    findProject: () => null,
    isLoading: false,
  }),
}));
// The activity feed has its own tests; here we only check it's wired to the task
jest.mock('../Activity/ActivityFeed', () => ({
  ActivityFeed: ({ taskId }: { taskId?: string }) => (
    <div data-testid="activity-feed">activity for {taskId}</div>
  ),
}));
jest.mock('../FeatureCard/ProjectUpdatesTimeline', () => ({
  ProjectUpdatesTimeline: ({ canEdit }: { canEdit?: boolean }) => (
    <div data-testid="notes-timeline">{canEdit ? 'editable notes' : 'read-only notes'}</div>
  ),
}));

const mockTask: Project = {
  id: 'task-123',
  userId: 'user-1',
  project: 'Collaborative Task',
  status: 'do',
  priority: 7,
  size: '***',
  category: 'Solfit',
  projectId: 'proj-solfit',
  orgId: 'org-1',
  orgName: 'Solfit Org',
  isShared: true,
  canEdit: true,
  reporterId: 'user-2',
  reporterName: 'Bob Jones',
  updatedById: 'user-2',
  updatedByName: 'Bob Jones',
  assigneeId: null,
  assigneeName: null,
  isDeleted: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('TaskDetailView', () => {
  let mockAssignTaskMutate: jest.Mock;
  let mockLinkTaskGoalMutate: jest.Mock;
  let mockUpdateProjectMutate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAssignTaskMutate = jest.fn();
    mockLinkTaskGoalMutate = jest.fn();
    mockUpdateProjectMutate = jest.fn();

    (orgQueries.useOrganisations as jest.Mock).mockReturnValue({
      data: [{ id: 'org-1', name: 'Solfit Org' }],
    });
    (orgQueries.useOrganisationMembers as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'mem-1',
          userId: 'user-1',
          userName: 'Alice Smith',
          userEmail: 'alice@solfit.com',
          role: 'owner',
        },
        {
          id: 'mem-2',
          userId: 'user-2',
          userName: 'Bob Jones',
          userEmail: 'bob@solfit.com',
          role: 'member',
        },
      ],
    });
    (taskMutations.useAssignTask as jest.Mock).mockReturnValue({
      mutate: mockAssignTaskMutate,
    });
    (taskMutations.useLinkTaskGoal as jest.Mock).mockReturnValue({
      mutate: mockLinkTaskGoalMutate,
    });
    (projectMutations.useUpdateProject as jest.Mock).mockReturnValue({
      mutate: mockUpdateProjectMutate,
    });
    (projectMutations.useMergeProjects as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  const renderComponent = (task: Project = mockTask) => {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme}>
          <TaskDetailView task={task} />
        </MantineProvider>
      </QueryClientProvider>
    );
  };

  it('renders task details with title and assignee selector', () => {
    renderComponent();

    expect(screen.getByDisplayValue('Collaborative Task')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /assignee/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^project/i })).toHaveValue('Solfit');
    expect(screen.getByRole('textbox', { name: /linked life goal/i })).toBeInTheDocument();
    expect(screen.getByText('Only you can see your life goal links')).toBeInTheDocument();
  });

  it('shows the workspace, who created and last updated the task, and its activity', () => {
    renderComponent();

    expect(screen.getByText('Solfit Org')).toBeInTheDocument();
    const attribution = screen.getByTestId('task-attribution');
    expect(attribution).toHaveTextContent('Created by Bob Jones');
    expect(attribution).toHaveTextContent('Unassigned');
    expect(attribution).toHaveTextContent('Last updated by Bob Jones');
    expect(screen.getByTestId('activity-feed')).toHaveTextContent('activity for task-123');
  });

  it('says "you" for things I did', () => {
    renderComponent({ ...mockTask, reporterId: 'user-1', reporterName: 'Alice Smith' });

    expect(screen.getByTestId('task-attribution')).toHaveTextContent('Created by you');
  });

  it('assigns the task to me with one click', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: /assign to me/i }));

    expect(mockAssignTaskMutate).toHaveBeenCalledWith({
      taskId: 'task-123',
      assigneeId: 'user-1',
      assigneeName: 'Alice Smith',
    });
  });

  it('is read-only for viewers', () => {
    renderComponent({ ...mockTask, canEdit: false, myRole: 'viewer' });

    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Collaborative Task')).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: /assignee/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete task/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /assign to me/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('notes-timeline')).toHaveTextContent('read-only notes');
  });

  it('triggers assignTask mutation when selecting an assignee', async () => {
    const user = userEvent.setup();
    renderComponent();

    const assigneeInput = screen.getByRole('textbox', { name: /assignee/i });
    await user.click(assigneeInput);

    const option = await screen.findByRole('option', { name: /bob jones/i });
    await user.click(option);

    expect(mockAssignTaskMutate).toHaveBeenCalledWith({
      taskId: 'task-123',
      assigneeId: 'user-2',
      assigneeName: 'Bob Jones',
    });
  });

  it('saves my private life goal link on the task when selecting a goal', async () => {
    const user = userEvent.setup();
    renderComponent();

    const goalInput = screen.getByRole('textbox', { name: /linked life goal/i });
    await user.click(goalInput);

    const option = await screen.findByRole('option', { name: /\[FOCUS\] Learn Rust/i });
    await user.click(option);

    expect(mockUpdateProjectMutate).toHaveBeenCalledWith({
      projectId: 'task-123',
      data: { goalId: 'goal-1' },
    });
  });
});
