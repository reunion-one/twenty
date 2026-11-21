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

import { SettingsAiToolAvailabilitySection } from '@/settings/ai/tool-availability/components/SettingsAiToolAvailabilitySection';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import {
  AiToolAvailabilitiesDocument,
  AiToolAvailabilityLimitsDocument,
  SetAiToolAvailabilityDocument,
  type AiToolAvailabilitiesQuery,
} from '~/generated-metadata/graphql';

jest.mock('@/settings/roles/hooks/useHasPermissionFlag');

// jsdom lacks PointerEvent, which the shared switch uses to forward clicks.
beforeAll(() => {
  Object.defineProperty(window, 'PointerEvent', {
    value: MouseEvent,
    configurable: true,
  });
});

const limits = {
  __typename: 'AiToolAvailabilityLimits' as const,
  neverAvailableToAgents: ['create_file_upload'],
  neverAvailableOverMcp: ['code_interpreter'],
};

const renderSection = (
  additionalMocks: MockedResponse[] = [],
  rows: AiToolAvailabilitiesQuery['aiToolAvailabilities'] = [],
  toolName = 'search',
) => {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: AiToolAvailabilitiesDocument,
    data: { aiToolAvailabilities: rows },
  });
  cache.writeQuery({
    query: AiToolAvailabilityLimitsDocument,
    data: { aiToolAvailabilityLimits: limits },
  });
  return render(
    <MockedProvider
      cache={cache}
      mocks={[
        {
          request: { query: AiToolAvailabilitiesDocument },
          result: { data: { aiToolAvailabilities: rows } },
        },
        {
          request: { query: AiToolAvailabilityLimitsDocument },
          result: { data: { aiToolAvailabilityLimits: limits } },
        },
        ...additionalMocks,
      ]}
    >
      <I18nProvider i18n={i18n}>
        <ThemeProvider colorScheme="light">
          <MemoryRouter>
            <ToastProvider>
              <SettingsAiToolAvailabilitySection
                toolIdentifier={toolName}
                toolName={toolName}
              />
              <Toaster />
            </ToastProvider>
          </MemoryRouter>
        </ThemeProvider>
      </I18nProvider>
    </MockedProvider>,
  );
};

describe('@custom SettingsAiToolAvailabilitySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useHasPermissionFlag).mockReturnValue(true);
  });

  it('autosaves the toggled switch and preserves the other channel', async () => {
    const input = {
      toolIdentifier: 'search',
      isAgentEnabled: false,
      isMcpEnabled: false,
    };
    const mutation = jest.fn(() => ({
      data: {
        setAiToolAvailability: {
          __typename: 'AiToolAvailability',
          toolName: 'search',
          ...input,
        },
      },
    }));
    renderSection(
      [
        {
          request: {
            query: SetAiToolAvailabilityDocument,
            variables: { input },
          },
          result: mutation,
        },
      ],
      [
        {
          __typename: 'AiToolAvailability',
          toolIdentifier: 'search',
          toolName: 'search',
          isAgentEnabled: true,
          isMcpEnabled: false,
        },
      ],
    );
    const agentsSwitch = screen.getByRole('switch', { name: 'Agents' });
    await waitFor(() =>
      expect(agentsSwitch).not.toHaveAttribute('aria-disabled', 'true'),
    );
    await userEvent.click(agentsSwitch);
    await waitFor(() => expect(mutation).toHaveBeenCalledWith({ input }));
    expect(agentsSwitch).not.toBeChecked();
  });

  it('reverts the optimistic switch and shows an error when saving fails', async () => {
    const input = {
      toolIdentifier: 'search',
      isAgentEnabled: false,
      isMcpEnabled: true,
    };
    renderSection([
      {
        request: { query: SetAiToolAvailabilityDocument, variables: { input } },
        error: new Error('Could not save availability'),
        delay: 100,
      },
    ]);
    const agentsSwitch = screen.getByRole('switch', { name: 'Agents' });
    await waitFor(() =>
      expect(agentsSwitch).not.toHaveAttribute('aria-disabled', 'true'),
    );
    await userEvent.click(agentsSwitch);
    expect(agentsSwitch).not.toBeChecked();
    expect(
      await screen.findByText('Could not save availability'),
    ).toBeInTheDocument();
    await waitFor(() => expect(agentsSwitch).toBeChecked());
  });

  it('locks a never-offered tool with its explanation', async () => {
    renderSection([], [], 'code_interpreter');
    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: 'Agents' }),
      ).not.toHaveAttribute('aria-disabled', 'true'),
    );
    const mcpSwitch = screen.getByRole('switch', { name: 'MCP' });
    expect(mcpSwitch).toHaveAttribute('aria-disabled', 'true');
    expect(mcpSwitch).not.toBeChecked();
    expect(mcpSwitch).toHaveAccessibleDescription('Never available over MCP');
  });

  it('disables switches without AI_SETTINGS', async () => {
    jest.mocked(useHasPermissionFlag).mockReturnValue(false);
    renderSection();
    expect(screen.getByRole('switch', { name: 'Agents' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'MCP' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
