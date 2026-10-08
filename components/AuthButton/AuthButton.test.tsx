import React from 'react';
import { screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { render } from '../../test-utils/render';
import { AuthButton } from './AuthButton';

const useSessionMock = useSession as jest.Mock;

describe('AuthButton', () => {
  it('renders Sign In button when user is not authenticated', () => {
    // Arrange & Act
    useSessionMock.mockReturnValueOnce({ data: null, status: 'unauthenticated' });
    render(<AuthButton />, { session: null });

    // Assert
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('renders Sign Out button when user is authenticated', () => {
    // Arrange & Act
    useSessionMock.mockReturnValueOnce({
      data: { user: { name: 'Test User' }, accessToken: 'token' },
      status: 'authenticated',
    });
    render(<AuthButton />);

    // Assert
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });
});
