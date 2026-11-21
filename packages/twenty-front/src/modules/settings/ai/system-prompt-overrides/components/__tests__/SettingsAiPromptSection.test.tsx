import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { msg } from '@lingui/core/macro';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { useCallback, useState, type ComponentProps } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'jotai';
import { ThemeProvider } from 'twenty-ui/theme';
import { SettingsAiPromptSectionList } from '@/settings/ai/system-prompt-overrides/components/SettingsAiPromptSectionList';
import { useAiSystemPromptOverrides } from '@/settings/ai/system-prompt-overrides/hooks/useAiSystemPromptOverrides';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { type FormAdvancedTextFieldInput } from '@/advanced-text-editor/components/FormAdvancedTextFieldInput';

jest.mock(
  '@/settings/ai/system-prompt-overrides/hooks/useAiSystemPromptOverrides',
);
jest.mock('@/settings/roles/hooks/useHasPermissionFlag');
jest.mock(
  '@/settings/ai/system-prompt-overrides/components/SettingsAiPromptVariablePicker',
  () => ({ SettingsAiPromptVariablePicker: () => null }),
);
jest.mock(
  '@/advanced-text-editor/components/FormAdvancedTextFieldInput',
  () => ({
    FormAdvancedTextFieldInput: ({
      defaultValue,
      readonly,
      onChange,
      'aria-label': ariaLabel,
    }: ComponentProps<typeof FormAdvancedTextFieldInput>) => {
      const [initialized, setInitialized] = useState(false);
      const [value, setValue] = useState(`normalized:${defaultValue}`);
      const initialize = useCallback(
        (element: HTMLTextAreaElement | null) => {
          if (element && !readonly && !initialized) {
            setInitialized(true);
            onChange?.(`normalized:${defaultValue}`);
          }
        },
        [defaultValue, readonly, onChange, initialized],
      );

      return readonly ? (
        <div>{defaultValue}</div>
      ) : (
        <textarea
          ref={initialize}
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onChange?.(event.target.value);
          }}
        />
      );
    },
  }),
);

const upsert = jest.fn();
const deleteOverride = jest.fn();
const section = {
  __typename: 'AiSystemPromptSection' as const,
  title: 'Base Instructions',
  content: 'Rendered prompt',
  estimatedTokenCount: 10,
};
const overrideSection = {
  __typename: 'AiSystemPromptOverrideSection' as const,
  sectionKey: 'baseInstructions',
  title: 'Base Instructions',
  defaultTemplate: 'Default prompt',
  overrideContent: 'Custom prompt',
  isDefaultChanged: false,
};
const sectionListTree = (isVisible = true, sections = [section]) => (
  <Provider>
    <I18nProvider i18n={i18n}>
      <ThemeProvider colorScheme="light">
        {isVisible && <SettingsAiPromptSectionList sections={sections} />}
      </ThemeProvider>
    </I18nProvider>
  </Provider>
);
const renderSection = () => render(sectionListTree());

describe('@custom SettingsAiPromptSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useHasPermissionFlag).mockReturnValue(true);
    jest.mocked(useAiSystemPromptOverrides).mockReturnValue({
      sections: [overrideSection],
      upsert,
      deleteOverride,
      isSaving: false,
    });
    upsert.mockResolvedValue(true);
    deleteOverride.mockResolvedValue(true);
  });

  it('edits two sections and saves one without affecting the other', async () => {
    const user = userEvent.setup();
    const otherSection = {
      ...section,
      title: 'Response Format',
      content: 'Rendered format',
    };
    jest.mocked(useAiSystemPromptOverrides).mockReturnValue({
      sections: [
        overrideSection,
        {
          ...overrideSection,
          sectionKey: 'responseFormat',
          title: 'Response Format',
        },
      ],
      upsert,
      deleteOverride,
      isSaving: false,
    });
    render(sectionListTree(true, [section, otherSection]));
    await user.click(
      screen.getByRole('button', { name: 'Edit Base Instructions' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Edit Response Format' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Base Instructions' }),
      '!',
    );
    const otherEditor = screen.getByRole('textbox', {
      name: 'Response Format',
    });
    await user.type(otherEditor, ' draft');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    expect(upsert).toHaveBeenCalledWith(
      'baseInstructions',
      'normalized:Custom prompt!',
    );
    expect(
      screen.getByRole('textbox', { name: 'Response Format' }),
    ).toHaveValue('normalized:Custom prompt draft');
    expect(
      screen.queryByRole('textbox', { name: 'Base Instructions' }),
    ).not.toBeInTheDocument();
  });

  it('starts in view mode after the list is unmounted and remounted', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSection();
    await user.click(
      screen.getByRole('button', { name: 'Edit Base Instructions' }),
    );
    await user.type(screen.getByRole('textbox'), 'unsaved draft');
    rerender(sectionListTree(false));
    rerender(sectionListTree());

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Base Instructions' }),
    ).toBeVisible();
    expect(screen.getByText('Rendered prompt')).toBeVisible();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('ignores mount normalization, then saves a user edit', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(
      screen.getByRole('button', { name: 'Edit Base Instructions' }),
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    const editor = screen.getByRole('textbox', { name: 'Base Instructions' });
    await user.clear(editor);
    await user.type(editor, 'Changed prompt');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(upsert).toHaveBeenCalledWith('baseInstructions', 'Changed prompt');
    expect(screen.getByText('Rendered prompt')).toBeVisible();
  });

  it('resets then deletes without treating normalized content as an edit', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(
      screen.getByRole('button', { name: 'Edit Base Instructions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(screen.getByRole('textbox')).toHaveValue(
      'normalized:Default prompt',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(deleteOverride).toHaveBeenCalledWith('baseInstructions');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts a real edit after reset', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(
      screen.getByRole('button', { name: 'Edit Base Instructions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    await user.type(screen.getByRole('textbox'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(upsert).toHaveBeenCalledWith(
      'baseInstructions',
      'normalized:Default prompt!',
    );
    expect(deleteOverride).not.toHaveBeenCalled();
  });

  it('cancels back to view mode', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(
      screen.getByRole('button', { name: 'Edit Base Instructions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Rendered prompt')).toBeVisible();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('stays in edit mode when saving fails', async () => {
    const user = userEvent.setup();
    upsert.mockResolvedValue(false);
    renderSection();
    await user.click(
      screen.getByRole('button', { name: 'Edit Base Instructions' }),
    );
    await user.type(screen.getByRole('textbox'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('textbox')).toBeVisible();
  });

  it('uses the server friendly message for the unknown-variable toast', () => {
    const names = 'user.fistName';
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Unknown system prompt variables: user.fistName',
          extensions: { userFriendlyMessage: msg`Unknown variables: ${names}` },
        },
      ],
    });

    expect(getToastOptionsFromError({ error })).toMatchObject({
      status: 'error',
      children: 'Unknown variables: user.fistName',
    });
  });

  it('hides edit without AI_SETTINGS', () => {
    jest.mocked(useHasPermissionFlag).mockReturnValue(false);
    renderSection();
    expect(
      screen.queryByRole('button', { name: 'Edit Base Instructions' }),
    ).not.toBeInTheDocument();
  });
});
