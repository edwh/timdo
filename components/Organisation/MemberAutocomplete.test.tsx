import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { useSearchUsers } from '../../app/hooks/useOrganisationQueries';
import { theme } from '../../theme';
import { MemberAutocomplete } from './MemberAutocomplete';

jest.mock('../../app/hooks/useOrganisationQueries', () => ({
  useSearchUsers: jest.fn(),
}));

const mockSearchResults = [
  {
    id: 'user-1',
    name: 'Sarah Jenkins',
    email: 'sarah@xebit.io',
    isMember: true,
    role: 'admin' as const,
  },
  {
    id: 'user-2',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    isMember: false,
  },
];

describe('MemberAutocomplete', () => {
  const onSelectExistingUser = jest.fn();
  const onSelectInviteEmail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSearchUsers as jest.Mock).mockReturnValue({
      data: mockSearchResults,
      isLoading: false,
    });
  });

  const renderComponent = () =>
    render(
      <MantineProvider theme={theme}>
        <MemberAutocomplete
          orgId="org-123"
          onSelectExistingUser={onSelectExistingUser}
          onSelectInviteEmail={onSelectInviteEmail}
        />
      </MantineProvider>
    );

  it('renders input field with placeholder', () => {
    renderComponent();
    expect(
      screen.getByPlaceholderText('Search user by name/email or enter new email...')
    ).toBeInTheDocument();
  });

  it('shows autocomplete search results when typing', async () => {
    renderComponent();
    const input = screen.getByPlaceholderText('Search user by name/email or enter new email...');
    await userEvent.type(input, 'alex');

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
      expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    });
  });

  it('invokes onSelectExistingUser when clicking a non-member search result', async () => {
    renderComponent();
    const input = screen.getByPlaceholderText('Search user by name/email or enter new email...');
    await userEvent.type(input, 'alex');

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    const userOption = screen.getByTestId('user-option-user-2');
    await userEvent.click(userOption);

    expect(onSelectExistingUser).toHaveBeenCalledWith(mockSearchResults[1]);
  });

  it('offers email invitation option for new email addresses', async () => {
    (useSearchUsers as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderComponent();
    const input = screen.getByPlaceholderText('Search user by name/email or enter new email...');
    await userEvent.type(input, 'newperson@company.com');

    await waitFor(() => {
      expect(screen.getByTestId('invite-email-option')).toBeInTheDocument();
    });

    const inviteOption = screen.getByTestId('invite-email-option');
    await userEvent.click(inviteOption);

    expect(onSelectInviteEmail).toHaveBeenCalledWith('newperson@company.com');
  });
});
