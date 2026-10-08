import React from 'react';
import { render, screen, within } from '@testing-library/react';
import type { Project } from '../../app/types/project.types';
import PrintableSvgPoster from './PrintableSvgPoster';

const makeProject = (overrides: Partial<Project>): Project => ({
  id: overrides.id ?? 'project-id',
  userId: 'user-id',
  project: overrides.project ?? 'Example project',
  reason: overrides.reason ?? 'Because it matters',
  status: overrides.status ?? 'do',
  priority: overrides.priority ?? 1,
  size: overrides.size ?? '*',
  notes: overrides.notes ?? '',
  statusLastChangedOn: overrides.statusLastChangedOn ?? '2026-07-10T00:00:00.000Z',
  awaitUntil: overrides.awaitUntil ?? null,
  isDeleted: false,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
});

describe('PrintableSvgPoster awaiting section', () => {
  it('renders awaiting projects between delay and done with return dates', () => {
    render(
      <PrintableSvgPoster
        user="Tim"
        projects={[
          makeProject({ id: 'do-1', project: 'Do project', status: 'do' }),
          makeProject({ id: 'delay-1', project: 'Delay project', status: 'delay' }),
          makeProject({
            id: 'awaiting-1',
            project: 'Renew passport',
            status: 'awaiting',
            awaitUntil: '2026-08-03',
          }),
          makeProject({ id: 'done-1', project: 'Done project', status: 'done' }),
        ]}
      />
    );

    const svg = screen.getByRole('img');
    const sectionTitles = Array.from(svg.querySelectorAll('.section-title')).map(
      (element) => element.textContent
    );

    expect(sectionTitles).toEqual(['DO', 'DELAY', 'AWAITING', 'DONE']);
    expect(screen.getByText('Renew passport')).toBeInTheDocument();
    expect(screen.getByText('3 Aug 26')).toBeInTheDocument();
  });

  it('sorts awaiting projects by return date then priority and filters null dates', () => {
    render(
      <PrintableSvgPoster
        user="Tim"
        projects={[
          makeProject({
            id: 'awaiting-late',
            project: 'Later low priority',
            status: 'awaiting',
            priority: 1,
            awaitUntil: '2026-09-01',
          }),
          makeProject({
            id: 'awaiting-null',
            project: 'No date project',
            status: 'awaiting',
            awaitUntil: null,
          }),
          makeProject({
            id: 'awaiting-early-low',
            project: 'Early low priority',
            status: 'awaiting',
            priority: 2,
            awaitUntil: '2026-08-01',
          }),
          makeProject({
            id: 'awaiting-early-high',
            project: 'Early high priority',
            status: 'awaiting',
            priority: 5,
            awaitUntil: '2026-08-01',
          }),
        ]}
      />
    );

    const svg = screen.getByRole('img');
    const textContent = Array.from(svg.querySelectorAll('text')).map(
      (element) => element.textContent
    );

    expect(textContent.indexOf('Early high priority')).toBeLessThan(
      textContent.indexOf('Early low priority')
    );
    expect(textContent.indexOf('Early low priority')).toBeLessThan(
      textContent.indexOf('Later low priority')
    );
    expect(screen.queryByText('No date project')).not.toBeInTheDocument();
  });

  it('omits the awaiting section when there are no awaiting projects with return dates', () => {
    render(
      <PrintableSvgPoster
        user="Tim"
        projects={[
          makeProject({ id: 'do-1', project: 'Do project', status: 'do' }),
          makeProject({
            id: 'awaiting-null',
            project: 'No date project',
            status: 'awaiting',
            awaitUntil: null,
          }),
          makeProject({ id: 'done-1', project: 'Done project', status: 'done' }),
        ]}
      />
    );

    const svg = screen.getByRole('img');

    expect(within(svg).queryByText('AWAITING')).not.toBeInTheDocument();
    expect(within(svg).queryByText('No date project')).not.toBeInTheDocument();
  });
});
