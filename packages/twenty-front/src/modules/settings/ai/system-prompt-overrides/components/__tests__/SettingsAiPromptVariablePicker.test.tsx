import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'jotai';
import { ThemeProvider } from 'twenty-ui/theme';
import { SettingsAiPromptVariablePicker } from '@/settings/ai/system-prompt-overrides/components/SettingsAiPromptVariablePicker';

describe('@custom SettingsAiPromptVariablePicker', () => {
  it('shows a variable description and preserves row selection', async () => {
    const user = userEvent.setup();
    const onVariableSelect = jest.fn();
    render(
      <Provider>
        <I18nProvider i18n={i18n}>
          <ThemeProvider colorScheme="light">
            <SettingsAiPromptVariablePicker
              instanceId="test"
              onVariableSelect={onVariableSelect}
            />
          </ThemeProvider>
        </I18nProvider>
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Insert variable' }));
    expect(
      screen.getByText(
        'A bulleted list of exact workflow tool names, or a sentence saying none are available. A trailing check mark means pre-loaded.',
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: /Workflow tools list/ }),
    );
    expect(onVariableSelect).toHaveBeenCalledWith('{{tools.workflow.list}}');
  });
});
