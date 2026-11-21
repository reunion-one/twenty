import { InMemoryCache } from '@apollo/client';
import { type MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider, Toaster } from 'twenty-ui/components/feedback';
import { ThemeProvider } from 'twenty-ui/theme';

import { SettingsAiAvailabilityTab } from '@/settings/ai/tool-availability/components/SettingsAiAvailabilityTab';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import {
  AiToolAvailabilitiesDocument,
  AiToolAvailabilityLimitsDocument,
  SetAiToolAvailabilitiesDocument,
} from '~/generated-metadata/graphql';
import { useSettingsAgentToolsTable } from '~/pages/settings/ai/hooks/useSettingsAgentToolsTable';

jest.mock('@/settings/roles/hooks/useHasPermissionFlag');
jest.mock('~/pages/settings/ai/hooks/useSettingsAgentToolsTable');

// jsdom lacks PointerEvent, which the shared checkbox uses to forward clicks.
beforeAll(() => {
  Object.defineProperty(window, 'PointerEvent', {
    value: MouseEvent,
    configurable: true,
  });
});

const renderTab = (additionalMocks: MockedResponse[] = []) => {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: AiToolAvailabilitiesDocument,
    data: {
      aiToolAvailabilities: [
        {
          __typename: 'AiToolAvailability',
          toolIdentifier: 'search',
          toolName: 'search',
          isAgentEnabled: false,
          isMcpEnabled: true,
        },
      ],
    },
  });
  cache.writeQuery({
    query: AiToolAvailabilityLimitsDocument,
    data: {
      aiToolAvailabilityLimits: {
        __typename: 'AiToolAvailabilityLimits',
        neverAvailableToAgents: ['create_file_upload'],
        neverAvailableOverMcp: [],
      },
    },
  });

  render(
    <MockedProvider cache={cache} mocks={additionalMocks}>
      <I18nProvider i18n={i18n}>
        <ThemeProvider colorScheme="light">
          <MemoryRouter>
            <ToastProvider>
              <SettingsAiAvailabilityTab />
              <Toaster />
            </ToastProvider>
          </MemoryRouter>
        </ThemeProvider>
      </I18nProvider>
    </MockedProvider>,
  );
  return cache;
};

describe('SettingsAiAvailabilityTab @custom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useHasPermissionFlag).mockReturnValue(true);
    jest.mocked(useSettingsAgentToolsTable).mockReturnValue({
      allTools: [
        { identifier: 'search', name: 'search', label: 'Shown first' },
        { identifier: 'other', name: 'other', label: 'Shown second' },
        {
          identifier: 'create_file_upload',
          name: 'create_file_upload',
          label: 'Shown locked',
        },
        { identifier: 'hidden', name: 'hidden', label: 'Other tool' },
      ],
      applicationById: new Map(),
      marketplaceAppByUniversalIdentifier: new Map(),
      currentWorkspace: null,
      isLoading: false,
    });
  });

  it('applies the Agents All row to shown unlocked tools and shows mixed state', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.type(screen.getByPlaceholderText('Search a tool...'), 'Shown');
    const allAgents = screen.getByRole('checkbox', {
      name: 'Agents for all shown tools',
    });
    expect(allAgents).toHaveAttribute('aria-checked', 'mixed');
    expect(
      screen.queryByRole('checkbox', { name: 'Agents for Other tool' }),
    ).not.toBeInTheDocument();
    const lockedAgents = screen.getByRole('checkbox', {
      name: 'Agents for Shown locked',
    });
    expect(lockedAgents).toHaveAttribute('aria-disabled', 'true');
    expect(lockedAgents).not.toBeChecked();

    await user.click(allAgents);
    expect(allAgents).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Agents for Shown first' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Agents for Shown second' }),
    ).toBeChecked();
    expect(lockedAgents).not.toBeChecked();

    await user.click(allAgents);
    expect(
      screen.getByRole('checkbox', { name: 'Agents for Shown first' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Agents for Shown second' }),
    ).not.toBeChecked();
    expect(lockedAgents).not.toBeChecked();
    await user.clear(screen.getByPlaceholderText('Search a tool...'));
    expect(
      screen.getByRole('checkbox', { name: 'Agents for Other tool' }),
    ).toBeChecked();
    await user.type(screen.getByPlaceholderText('Search a tool...'), 'locked');
    expect(
      screen.getByRole('checkbox', { name: 'Agents for all shown tools' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('saves only changed rows in one mutation and clears the draft after success', async () => {
    const user = userEvent.setup();
    const input = {
      items: [
        { toolIdentifier: 'search', isAgentEnabled: true, isMcpEnabled: true },
      ],
    };
    const mutation = jest.fn(() => ({
      data: {
        setAiToolAvailabilities: [
          {
            __typename: 'AiToolAvailability',
            toolName: 'search',
            ...input.items[0],
          },
        ],
      },
    }));
    const cache = renderTab([
      {
        request: {
          query: SetAiToolAvailabilitiesDocument,
          variables: { input },
        },
        result: mutation,
      },
    ]);
    await user.click(
      screen.getByRole('checkbox', { name: 'Agents for Shown first' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Agents for Shown second' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Agents for Shown second' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
    expect(mutation).toHaveBeenCalledWith({ input });
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Save' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: 'Cancel' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Agents for Shown first' }),
    ).toBeChecked();
    expect(
      cache.readQuery({ query: AiToolAvailabilitiesDocument })
        ?.aiToolAvailabilities,
    ).toEqual([]);
  });
});
