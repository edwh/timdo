import React from 'react';
import { screen } from '@testing-library/react';
import { render } from '../../test-utils/render';
import { AppLayout } from './AppLayout';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/board'),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { name: 'Tim' } },
    status: 'authenticated',
  })),
  signOut: jest.fn(),
}));

// Mock project mutations hook
jest.mock('../../app/hooks/useProjectMutations', () => ({
  useCreateProject: jest.fn(() => ({
    mutate: jest.fn(),
  })),
}));

// Mock VoiceCommand components
jest.mock('../VoiceCommand/VoiceCommand', () => ({
  VoiceCommand: () => <div data-testid="voice-command" />,
}));
jest.mock('../VoiceCommand/VoiceCommandIntro', () => ({
  VoiceCommandIntro: () => <div data-testid="voice-command-intro" />,
}));

describe('AppLayout', () => {
  it('renders Poster Studio navigation link navigating to /poster', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    const posterLink = screen.getByText('Poster Studio');
    expect(posterLink).toBeInTheDocument();
    expect(posterLink.closest('a')).toHaveAttribute('href', '/poster');
  });

  it('links to the Sharing and Activity pages', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByText('Sharing').closest('a')).toHaveAttribute('href', '/sharing');
    expect(screen.getByText('Activity').closest('a')).toHaveAttribute('href', '/activity');
  });
});
