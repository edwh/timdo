import React from 'react';
import { screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { render } from '../../../test-utils/render';
import ProjectDetailPage from './page';

// Mock next/navigation
const mockPush = jest.fn();
let mockParams = { name: 'Solfit' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => mockParams,
}));

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const useSessionMock = useSession as jest.Mock;

// Mock fetch
global.fetch = jest.fn();
const fetchMock = global.fetch as jest.Mock;
const WORKER_API_URL = 'https://worker.example.com/api/v2';

const mockProjects = [
  {
    id: 'p-1',
    userId: 'user-1',
    project: 'Design Solar Inverter Mounting',
    reason: 'For Solfit deployment',
    status: 'do',
    priority: 9,
    size: '***',
    category: 'Solfit',
    epicId: 'epic-solfit-1',
    goalId: 'goal-1',
    isDeleted: false,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'p-2',
    userId: 'user-1',
    project: 'Order inverter cables',
    reason: 'Pending supplier quote',
    status: 'awaiting',
    awaitUntil: '2026-09-15',
    priority: 5,
    size: '*',
    category: 'Solfit',
    epicId: 'epic-solfit-1',
    goalId: 'goal-1',
    isDeleted: false,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'p-3',
    userId: 'user-1',
    project: 'Site survey completed',
    reason: 'Initial inspection',
    status: 'done',
    priority: 3,
    size: '**',
    category: 'Solfit',
    epicId: 'epic-solfit-1',
    goalId: 'goal-1',
    isDeleted: false,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'p-other',
    userId: 'user-1',
    project: 'Personal task not in Solfit',
    status: 'do',
    priority: 5,
    size: '*',
    category: 'Personal',
    isDeleted: false,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
];

const mockEpics = [
  {
    id: 'epic-solfit-1',
    userId: 'user-1',
    title: 'Deploy Acme Solar Array',
    description: 'Hardware installation and grid connect',
    category: 'Solfit',
    goalId: 'goal-1',
    status: 'active',
    totalTasks: 3,
    doneTasks: 1,
    progressPercentage: 33,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
];

describe('ProjectDetailPage (/projects/[name])', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_WORKER_API_BASE_URL = WORKER_API_URL;
    useSessionMock.mockReturnValue({
      data: {
        user: { name: 'Test User' },
        accessToken: 'test-token',
      },
      status: 'authenticated',
    });

    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/projects') && !url.includes('/updates')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProjects,
        });
      }
      if (url.includes('/epics')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockEpics,
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
  });

  it('renders category title, epics with progress bar, and tasks grouped by DO/AWAITING/DONE', async () => {
    mockParams = { name: 'Solfit' };
    render(<ProjectDetailPage />);

    // Header & Category title
    expect(await screen.findByText('Solfit')).toBeInTheDocument();

    // Epic card and progress
    expect(screen.getByText('Deploy Acme Solar Array')).toBeInTheDocument();
    expect(screen.getByText('33% (1/3 tasks)')).toBeInTheDocument();

    // Tasks grouped
    expect(screen.getByText('Design Solar Inverter Mounting')).toBeInTheDocument();
    expect(screen.getByText('Order inverter cables')).toBeInTheDocument();
    expect(screen.getByText('Site survey completed')).toBeInTheDocument();

    // Other category tasks should not appear
    expect(screen.queryByText('Personal task not in Solfit')).not.toBeInTheDocument();

    // Button to add task in project
    expect(screen.getByRole('button', { name: /New Task in Solfit/i })).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('labels a shared project with its workspace, shows assignees and respects view-only access', async () => {
    mockParams = { name: 'Solfit' };
    const sharedTasks = mockProjects
      .filter((p) => p.category === 'Solfit')
      .map((p) => ({
        ...p,
        orgId: 'org-md',
        orgName: 'Migrating Dragons',
        isShared: true,
        canEdit: false,
        myRole: 'viewer',
        assigneeId: 'user-ed',
        assigneeName: 'Robin Fairweather',
      }));
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/organisations/org-md/members')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { userId: 'user-ed', userName: 'Robin Fairweather', userEmail: 'ed@x.com', role: 'owner' },
          ],
        });
      }
      if (url.includes('/projects') && !url.includes('/updates')) {
        return Promise.resolve({ ok: true, json: async () => sharedTasks });
      }
      if (url.includes('/epics')) {
        return Promise.resolve({ ok: true, json: async () => mockEpics });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<ProjectDetailPage />);

    expect(await screen.findByText('Migrating Dragons')).toBeInTheDocument();
    expect(await screen.findByText('Shared with Robin Fairweather')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Assigned to Robin Fairweather' }).length).toBe(
      sharedTasks.length
    );
    expect(screen.getByRole('button', { name: /New Task in Solfit/i })).toBeDisabled();
    expect(screen.getByText('View only')).toBeInTheDocument();
  });
});
