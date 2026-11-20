import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { Editor } from '@tiptap/core';
import { EditorContent } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'twenty-ui/theme';
import { tipTapDocumentToMarkdown } from 'twenty-shared/utils';
import { AI_SYSTEM_PROMPT_EDITOR_PROFILE } from '@/settings/ai/system-prompt-overrides/constants/AiSystemPromptEditorProfile';
import { serializeAdvancedTextEditorDocument } from '@/advanced-text-editor/utils/serializeAdvancedTextEditorDocument';

describe('@custom prompt variable badge', () => {
  it('shows the display label while preserving the saved variable token', async () => {
    const extensions = AI_SYSTEM_PROMPT_EDITOR_PROFILE.buildExtensions(
      {},
    ).filter((extension) => extension.name === 'variableTag');
    expect(extensions).toHaveLength(1);
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, ...extensions],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'variableTag',
                attrs: { variable: '{{assistant.displayName}}' },
              },
            ],
          },
        ],
      },
    });
    const { unmount } = render(
      <I18nProvider i18n={i18n}>
        <ThemeProvider colorScheme="light">
          <EditorContent editor={editor} />
        </ThemeProvider>
      </I18nProvider>,
    );
    try {
      expect(await screen.findByText('Display name')).toBeVisible();
      expect(
        tipTapDocumentToMarkdown(serializeAdvancedTextEditorDocument(editor)),
      ).toBe('{{assistant.displayName}}');
      expect(editor.getJSON()).toMatchObject({
        content: [
          {
            content: [
              {
                type: 'variableTag',
                attrs: { variable: '{{assistant.displayName}}' },
              },
            ],
          },
        ],
      });
    } finally {
      unmount();
      editor.destroy();
    }
  });
});
