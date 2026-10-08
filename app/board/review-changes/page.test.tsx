import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import type { VoiceCommandResult } from '../../../components/VoiceCommand/voiceTypes';
import { render } from '../../../test-utils/render';
import ReviewChangesPage from './page';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
}));

const API = 'https://worker.example.com/api/v2';
const fetchMock = jest.fn();
global.fetch = fetchMock as any;

const result: VoiceCommandResult = {
  transcript: 'Add a Solfit task for Robin to check the inverter datasheet',
  summary: 'Added a task for Robin',
  warnings: [
    'You have view-only access to "Club Kit", so I left out "Buy rope".',
    'Robin Fairweather is busy.',
  ],
  me: { id: 'tim', name: 'Tim Dobson' },
  proposedChanges: [
    {
      type: 'create',
      before: null,
      after: { project: 'Check the inverter datasheet', status: 'do', priority: 5, size: '***' },
      projectId: 'proj-solfit',
      projectName: 'Solfit',
      orgName: 'Migrating Dragons',
      assigneeId: 'robin',
      assigneeName: 'Robin Fairweather',
      assigneeChanged: true,
      warnings: ['Robin Fairweather is busy.'],
    },
    {
      type: 'claim',
      before: {
        id: 'task-1',
        userId: 'tim',
        project: 'Acme Solar onboarding',
        status: 'do',
        priority: 7,
        size: '**',
        projectName: 'Solfit',
        assigneeId: null,
        assigneeName: null,
        isDeleted: false,
        createdAt: '',
        updatedAt: '',
      },
      after: null,
      taskId: 'task-1',
      projectId: 'proj-solfit',
      projectName: 'Solfit',
      orgName: 'Migrating Dragons',
      assigneeId: 'tim',
      assigneeName: 'Tim Dobson',
      assigneeChanged: true,
    },
  ],
};

describe('Review voice changes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_WORKER_API_BASE_URL = API;
    sessionStorage.setItem('timdo:voice-review', JSON.stringify(result));
  });

  it('shows the workspace, project, assignee, transcript and warnings', async () => {
    render(<ReviewChangesPage />);
    expect(await screen.findByText('New task')).toBeInTheDocument();
    expect(screen.getByText('Migrating Dragons / Solfit')).toBeInTheDocument();
    expect(screen.getByText('Assign to Robin Fairweather')).toBeInTheDocument();
    expect(screen.getByText(/Add a Solfit task for Robin/)).toBeInTheDocument();
    // Left-out changes at the top, this card's own warning on the card
    expect(screen.getByText('One thing was left out')).toBeInTheDocument();
    expect(
      screen.getByText('You have view-only access to "Club Kit", so I left out "Buy rope".')
    ).toBeInTheDocument();
    expect(screen.getByText('Robin Fairweather is busy.')).toBeInTheDocument();
    expect(screen.getByText('Change 1 of 2')).toBeInTheDocument();
  });

  it('applies with ids, shows "Assign to you" for a claim, and finishes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    render(<ReviewChangesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply and next' }));

    expect(await screen.findByText('Claim task')).toBeInTheDocument();
    expect(screen.getByText('Assign to you')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/projects`);
    expect(JSON.parse(init.body)).toMatchObject({ projectId: 'proj-solfit', assigneeId: 'robin' });

    fireEvent.click(screen.getByRole('button', { name: 'Apply and finish' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/board'));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ assigneeId: 'tim' });
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Review complete',
        message: 'Applied 2 changes, skipped 0.',
      })
    );
    expect(sessionStorage.getItem('timdo:voice-review')).toBeNull();
  });

  it("shows the API's 403 message and stays on the change", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'You have view-only access to "Solfit"' }),
    });
    render(<ReviewChangesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply and next' }));
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Not allowed',
          message: 'You have view-only access to "Solfit"',
          color: 'red',
        })
      )
    );
    expect(screen.getByText('New task')).toBeInTheDocument();
    expect(screen.getByText('You have view-only access to "Solfit"')).toBeInTheDocument();
  });

  it('counts skips', async () => {
    render(<ReviewChangesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/board'));
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Applied 0 changes, skipped 2.' })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('goes back to the board when there is nothing to review', async () => {
    sessionStorage.clear();
    render(<ReviewChangesPage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/board'));
  });
});
