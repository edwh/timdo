import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from '@mantine/core';
import type { Project } from '../../app/types/project.types';
import { TestWrapper } from '../../test-utils/render';
import { ProjectCard } from './ProjectCard';

const mockProject: Project = {
  id: '1',
  project: 'Test Project',
  reason: 'To test things',
  notes: 'Some notes here',
  status: 'do',
  priority: 10,
  size: '***',
  userId: 'user-123',
  isDeleted: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  statusLastChangedOn: '2024-01-01T00:00:00.000Z',
};

describe('ProjectCard', () => {
  it('renders in view mode by default and shows buttons when expanded', async () => {
    // Arrange
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    const onStatusChange = jest.fn();

    // Act
    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard project={mockProject} onUpdate={onUpdate} onStatusChange={onStatusChange} />
        </Accordion>
      </TestWrapper>
    );

    // Assert initial state
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();

    // Act: Open the accordion by clicking the specific control button
    const controlButton = screen.getByTestId(`project-card-control-${mockProject.id}`);
    await user.click(controlButton);

    // Assert: Buttons are now visible
    expect(await screen.findByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /mark as done/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('switches to edit mode when edit button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard project={mockProject} onUpdate={jest.fn()} onStatusChange={jest.fn()} />
        </Accordion>
      </TestWrapper>
    );

    // Act
    const controlButton = screen.getByTestId(`project-card-control-${mockProject.id}`);
    await user.click(controlButton); // Open accordion
    await user.click(await screen.findByRole('button', { name: /edit/i }));

    // Assert
    expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    // Check for interactive stars in the panel
    expect(await screen.findByRole('button', { name: /set rating to 1/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onUpdate with new values when save is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard project={mockProject} onUpdate={onUpdate} onStatusChange={jest.fn()} />
        </Accordion>
      </TestWrapper>
    );

    // Act
    const controlButton = screen.getByTestId(`project-card-control-${mockProject.id}`);
    await user.click(controlButton); // Open accordion
    await user.click(await screen.findByRole('button', { name: /edit/i }));
    const nameInput = screen.getByDisplayValue('Test Project');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Project Name');
    // Click the 5th star to change the size
    await user.click(await screen.findByRole('button', { name: /set rating to 5/i }));
    await user.click(await screen.findByRole('button', { name: /save/i }));

    // Assert
    expect(onUpdate).toHaveBeenCalledWith(
      mockProject.id,
      expect.objectContaining({
        project: 'Updated Project Name',
        size: '*****',
      })
    );
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('reverts to view mode and does not call onUpdate when cancel is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard project={mockProject} onUpdate={onUpdate} onStatusChange={jest.fn()} />
        </Accordion>
      </TestWrapper>
    );

    // Act
    const controlButton = screen.getByTestId(`project-card-control-${mockProject.id}`);
    await user.click(controlButton); // Open accordion
    await user.click(await screen.findByRole('button', { name: /edit/i }));
    const nameInput = screen.getByDisplayValue('Test Project');
    await user.clear(nameInput);
    await user.type(nameInput, 'A change that will be reverted');
    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    // Assert
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('A change that will be reverted')).not.toBeInTheDocument();
  });

  it('shows an assignee avatar with a tooltip label in shared workspaces', () => {
    const sharedTask: Project = {
      ...mockProject,
      id: '2',
      projectKey: 'XEB-12',
      isShared: true,
      orgName: 'Migrating Dragons',
      assigneeId: 'user-456',
      assigneeName: 'Sarah Jenkins',
    };

    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard project={sharedTask} onUpdate={jest.fn()} onStatusChange={jest.fn()} />
        </Accordion>
      </TestWrapper>
    );

    expect(screen.getByRole('img', { name: 'Assigned to Sarah Jenkins' })).toHaveTextContent('SJ');
    expect(screen.queryByTestId('claim-task-btn')).not.toBeInTheDocument();
  });

  it('keeps personal tasks uncluttered: no assignee avatar outside shared workspaces', () => {
    const personalTask: Project = {
      ...mockProject,
      id: '3',
      isShared: false,
      assigneeId: 'user-123',
      assigneeName: 'Tim Dobson',
    };

    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard project={personalTask} onUpdate={jest.fn()} onStatusChange={jest.fn()} />
        </Accordion>
      </TestWrapper>
    );

    expect(screen.queryByRole('img', { name: /assigned to/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Tim Dobson')).not.toBeInTheDocument();
  });

  it('offers "Assign to me" on unassigned tasks in a shared workspace', () => {
    const unassignedProject: Project = {
      ...mockProject,
      id: 'task-unassigned',
      projectKey: 'SOL-05',
      isShared: true,
      canEdit: true,
      assigneeId: null,
      assigneeName: null,
    };

    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard
            project={unassignedProject}
            onUpdate={jest.fn()}
            onStatusChange={jest.fn()}
          />
        </Accordion>
      </TestWrapper>
    );

    expect(screen.getByTestId('claim-task-btn')).toHaveTextContent('Assign to me');
  });

  it('shows who last updated a shared task when it was someone else', async () => {
    const user = userEvent.setup();
    const task: Project = {
      ...mockProject,
      id: 'task-updated',
      isShared: true,
      assigneeId: 'user-456',
      assigneeName: 'Robin Fairweather',
      updatedById: 'user-456',
      updatedByName: 'Robin Fairweather',
    };

    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard project={task} onUpdate={jest.fn()} onStatusChange={jest.fn()} />
        </Accordion>
      </TestWrapper>
    );

    await user.click(screen.getByTestId('project-card-control-task-updated'));
    expect(await screen.findByTestId('updated-by')).toHaveTextContent(
      'Last updated by Robin Fairweather'
    );
  });

  it('is view only when canEdit is false: no edit, delete or status changes', async () => {
    const user = userEvent.setup();
    const onStatusChange = jest.fn();
    const viewOnly: Project = {
      ...mockProject,
      id: 'task-view-only',
      isShared: true,
      canEdit: false,
      myRole: 'viewer',
      assigneeId: 'user-456',
      assigneeName: 'Robin Fairweather',
    };

    render(
      <TestWrapper>
        <Accordion transitionDuration={0}>
          <ProjectCard project={viewOnly} onUpdate={jest.fn()} onStatusChange={onStatusChange} />
        </Accordion>
      </TestWrapper>
    );

    expect(screen.getByText('View only')).toBeInTheDocument();
    await user.click(screen.getByTestId('project-card-control-task-view-only'));

    expect(await screen.findByRole('button', { name: /^edit$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /mark as done/i })).toBeDisabled();
    expect(screen.getAllByTestId('view-only-wrapper').length).toBeGreaterThan(0);
  });
});
