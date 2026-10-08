import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../test-utils/render';
import { CreateProjectModal } from './CreateProjectModal';

jest.mock('../../app/hooks/useEpicQueries', () => ({
  useEpics: () => ({ data: [] }),
}));
jest.mock('../../app/hooks/useGoalQueries', () => ({
  useGoals: () => ({ data: [] }),
}));
jest.mock('../../app/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ userId: 'user-tim', user: { id: 'user-tim', name: 'Tim' } }),
}));

const personalProject = {
  value: 'proj-crew',
  label: 'Crew',
  projectName: 'Crew',
  orgId: 'org-tim',
  orgLabel: 'Personal',
  isShared: false,
  canEdit: true,
};
const sharedProject = {
  value: 'proj-solfit',
  label: 'Solfit',
  projectName: 'Solfit',
  orgId: 'org-md',
  orgLabel: 'Migrating Dragons',
  isShared: true,
  canEdit: true,
};
const projectOptions = [personalProject, sharedProject];

jest.mock('../../app/hooks/useWorkspaces', () => ({
  useWorkspaceProjects: () => ({
    workspaces: [],
    projectOptions,
    // View-only workspaces never make it into the picker
    editableProjectGroups: [
      { group: 'Personal', items: [{ value: 'proj-crew', label: 'Crew' }] },
      { group: 'Migrating Dragons (shared)', items: [{ value: 'proj-solfit', label: 'Solfit' }] },
    ],
    findProject: (id: string | null) => projectOptions.find((p) => p.value === id) ?? null,
    hasSharedWorkspace: true,
    isLoading: false,
  }),
}));

jest.mock('../../app/hooks/useOrganisationQueries', () => ({
  useOrganisationMembers: () => ({
    data: [
      { id: 'm1', orgId: 'org-md', userId: 'user-tim', userName: 'Tim Dobson', role: 'owner' },
      {
        id: 'm2',
        orgId: 'org-md',
        userId: 'user-ed',
        userName: 'Robin Fairweather',
        role: 'member',
      },
    ],
    isLoading: false,
  }),
}));

describe('CreateProjectModal', () => {
  it('renders the form correctly and calls onSave with form data', async () => {
    const user = userEvent.setup();
    const handleSave = jest.fn();
    const handleClose = jest.fn();

    render(<CreateProjectModal opened onClose={handleClose} onSave={handleSave} />);

    await user.type(screen.getByLabelText(/task name/i), 'New Test Project');
    await user.type(screen.getByLabelText(/reason/i), 'A very good reason');
    await user.click(screen.getByLabelText('Delay'));
    await user.click(screen.getByRole('button', { name: /create task/i }));

    // No project picked: nothing about projects or assignees is sent
    expect(handleSave).toHaveBeenCalledWith({
      project: 'New Test Project',
      reason: 'A very good reason',
      status: 'delay',
      priority: 5,
      size: '***',
      awaitUntil: null,
      notes: '',
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('does not submit an awaiting task without a return date', async () => {
    const user = userEvent.setup();
    const handleSave = jest.fn();

    render(<CreateProjectModal opened onClose={jest.fn()} onSave={handleSave} />);

    await user.type(screen.getByLabelText(/task name/i), 'Awaiting without date');
    await user.type(screen.getByLabelText(/reason/i), 'Needs a return date');
    await user.click(screen.getByLabelText('Awaiting'));
    await user.click(screen.getByRole('button', { name: /create task/i }));

    expect(handleSave).not.toHaveBeenCalled();
  });

  it('shows validation errors for required fields', async () => {
    const handleSave = jest.fn();

    render(<CreateProjectModal opened onClose={jest.fn()} onSave={handleSave} />);

    // Submit directly: the browser's own "required" check would otherwise stop the submit
    fireEvent.submit(screen.getByRole('button', { name: /create task/i }).closest('form')!);

    expect(await screen.findByText('Task name is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/task name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/reason/i)).toHaveAttribute('aria-invalid', 'true');
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('offers projects grouped by workspace and only asks for an assignee in shared ones', async () => {
    const user = userEvent.setup();
    const handleSave = jest.fn();

    render(<CreateProjectModal opened onClose={jest.fn()} onSave={handleSave} />);

    // Personal project: no assignee picker, task stays mine by default
    await user.click(screen.getByRole('textbox', { name: /^project/i }));
    expect(await screen.findByText('Migrating Dragons (shared)')).toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Crew' }));
    expect(screen.queryByRole('textbox', { name: /assignee/i })).not.toBeInTheDocument();

    // Shared project: assignee picker appears, defaulting to me
    await user.click(screen.getByRole('textbox', { name: /^project/i }));
    await user.click(await screen.findByRole('option', { name: 'Solfit' }));
    const assignee = screen.getByRole('textbox', { name: /assignee/i });
    expect(assignee).toHaveValue('You (Tim Dobson)');

    await user.click(assignee);
    await user.click(await screen.findByRole('option', { name: /robin fairweather/i }));

    await user.type(screen.getByLabelText(/task name/i), 'Check inverter stock');
    await user.type(screen.getByLabelText(/reason/i), 'Install next week');
    await user.click(screen.getByRole('button', { name: /create task/i }));

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'Check inverter stock',
        projectId: 'proj-solfit',
        assigneeId: 'user-ed',
      })
    );
  });
});
