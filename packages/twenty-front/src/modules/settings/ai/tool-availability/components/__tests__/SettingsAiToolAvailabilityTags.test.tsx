import { MockedProvider } from '@apollo/client/testing/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, within } from '@testing-library/react';
import { ToastProvider } from 'twenty-ui/components/feedback';
import { ThemeProvider } from 'twenty-ui/theme';

import { SettingsAiToolAvailabilityTags } from '@/settings/ai/tool-availability/components/SettingsAiToolAvailabilityTags';
import { AiToolAvailabilitiesDocument } from '~/generated-metadata/graphql';

describe('@custom SettingsAiToolAvailabilityTags', () => {
  it('shows disabled-channel tags for the matching row and nothing for enabled tools', async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: AiToolAvailabilitiesDocument },
            result: {
              data: {
                aiToolAvailabilities: [
                  {
                    __typename: 'AiToolAvailability',
                    toolIdentifier: 'disabled',
                    toolName: 'disabled',
                    isAgentEnabled: false,
                    isMcpEnabled: false,
                  },
                  {
                    __typename: 'AiToolAvailability',
                    toolIdentifier: 'enabled',
                    toolName: 'enabled',
                    isAgentEnabled: true,
                    isMcpEnabled: true,
                  },
                ],
              },
            },
          },
        ]}
      >
        <I18nProvider i18n={i18n}>
          <ThemeProvider colorScheme="light">
            <ToastProvider>
              <section aria-label="Disabled tool">
                <SettingsAiToolAvailabilityTags toolIdentifier="disabled" />
              </section>
              <section aria-label="Enabled tool">
                <SettingsAiToolAvailabilityTags toolIdentifier="enabled" />
              </section>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </MockedProvider>,
    );
    const disabledTool = within(
      screen.getByRole('region', { name: 'Disabled tool' }),
    );
    expect(await disabledTool.findByText('Agents off')).toBeInTheDocument();
    expect(disabledTool.getByText('MCP off')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Enabled tool' }),
    ).toBeEmptyDOMElement();
  });
});
