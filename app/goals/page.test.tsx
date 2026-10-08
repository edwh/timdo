import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSession } from 'next-auth/react';
import { render } from '../../test-utils/render';
import GoalsPage from './page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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

const mockGoals = [
  {
    id: 'goal-1',
    userId: 'user-1',
    type: 'aim',
    title: 'Be great to my family',
    description: 'Support partner and kids',
    icon: '👨‍👩‍👦',
    orderIndex: 1,
    isActive: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'goal-2',
    userId: 'user-1',
    type: 'aim',
    title: 'Build something lucrative',
    description: 'Scale TimDo and AI tools',
    icon: '🚀',
    orderIndex: 2,
    isActive: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'goal-3',
    userId: 'user-1',
    type: 'focus',
    title: 'Develop modern tech skills',
    description: 'Master Cloudflare, Next.js and LLMs',
    icon: '💻',
    orderIndex: 1,
    isActive: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'goal-4',
    userId: 'user-1',
    type: 'value',
    title: 'Relentless Optimism',
    description: 'Be confident things will be ok while confronting brutal facts.',
    icon: null,
    orderIndex: 1,
    isActive: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'goal-5',
    userId: 'user-1',
    type: 'housekeeping',
    title: 'Weekly',
    description: 'Food shop and meal plan\nPut the bins out',
    icon: null,
    orderIndex: 1,
    isActive: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
];

const mockProjects = [
  {
    id: 'task-1',
    userId: 'user-1',
    project: 'Family dinner plan',
    reason: 'Quality time',
    status: 'do',
    priority: 8,
    size: '**',
    goalId: 'goal-1',
    isDeleted: false,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
];

const mockEpics = [
  {
    id: 'epic-1',
    userId: 'user-1',
    title: 'Scale Backend Infrastructure',
    description: 'Hono + D1 migration',
    goalId: 'goal-3',
    status: 'active',
    totalTasks: 5,
    doneTasks: 2,
    progressPercentage: 40,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
];

describe('GoalsDashboardPage (/goals)', () => {
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
      if (url.includes('/goals') && !url.includes('poster.svg')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockGoals,
        });
      }
      if (url.includes('/projects')) {
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
      if (url.includes('poster.svg')) {
        return Promise.resolve({
          ok: true,
          text: async () => '<svg>mock poster</svg>',
          blob: async () => new Blob(['<svg>mock poster</svg>'], { type: 'image/svg+xml' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
  });

  it('renders Aims, Focuses, Core Values, and Housekeeping habits', async () => {
    render(<GoalsPage />);

    expect(await screen.findByText('Be great to my family')).toBeInTheDocument();
    expect(screen.getByText('Build something lucrative')).toBeInTheDocument();
    expect(screen.getByText('Develop modern tech skills')).toBeInTheDocument();
    expect(screen.getByText(/Relentless Optimism/i)).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();

    // Verify action buttons
    expect(screen.getByRole('button', { name: /Edit Poster/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download SVG/i })).toBeInTheDocument();
  });

  it('toggles inline edit mode when Edit Poster button is clicked', async () => {
    render(<GoalsPage />);

    const editBtn = await screen.findByRole('button', { name: /Edit Poster/i });
    await userEvent.click(editBtn);

    // Edit button text updates
    expect(screen.getByRole('button', { name: /Done Editing/i })).toBeInTheDocument();
  });
});
