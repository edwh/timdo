import React from 'react';
import { DndContext } from '@dnd-kit/core';
import type { Project } from '../../app/types/project.types';
import { render, screen, within } from '../../test-utils';
import { ProjectSection } from './ProjectSection';

const awaitingProject: Project = {
  id: 'awaiting-1',
  userId: 'user-123',
  project: 'Awaiting Project',
  reason: 'Wait until later',
  status: 'awaiting',
  priority: 5,
  size: '***',
  notes: '',
  awaitUntil: '2026-08-03',
  isDeleted: false,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
  statusLastChangedOn: '2026-07-10T00:00:00.000Z',
};

const renderSection = (ui: React.ReactNode) => render(<DndContext>{ui}</DndContext>);

describe('ProjectSection awaiting rendering', () => {
  it('renders awaiting project cards with their project names visible', () => {
    renderSection(
      <ProjectSection
        id="awaiting"
        title="⏳ Awaiting (1)"
        projects={[awaitingProject]}
        defaultOpen={false}
        onUpdateProject={jest.fn()}
        onStatusChange={jest.fn()}
      />
    );

    const awaitingSection = screen.getByTestId('section-awaiting');

    expect(within(awaitingSection).getByRole('heading', { name: /awaiting/i })).toBeInTheDocument();
    // ProjectSection renders card controls even when panels are closed —
    // section-level collapse is handled at the board page level.
    expect(within(awaitingSection).getByText('Awaiting Project')).toBeInTheDocument();
  });

  it('renders nothing when projects array is empty', () => {
    renderSection(
      <ProjectSection
        id="awaiting"
        title="⏳ Awaiting (0)"
        projects={[]}
        defaultOpen={false}
        onUpdateProject={jest.fn()}
        onStatusChange={jest.fn()}
      />
    );

    expect(screen.queryByTestId('section-awaiting')).not.toBeInTheDocument();
  });

  it('expands accordion panels when alwaysExpanded is true', () => {
    renderSection(
      <ProjectSection
        id="awaiting"
        title="⏳ Awaiting (1)"
        projects={[awaitingProject]}
        alwaysExpanded
        onUpdateProject={jest.fn()}
        onStatusChange={jest.fn()}
      />
    );

    // Panel content should be visible when alwaysExpanded
    expect(screen.getByText('Wait until later')).toBeInTheDocument();
  });
});
