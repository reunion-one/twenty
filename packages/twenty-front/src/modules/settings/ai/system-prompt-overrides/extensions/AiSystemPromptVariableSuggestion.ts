import { i18n } from '@lingui/core';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { IconVariable } from 'twenty-ui/icon';

import { type SlashCommandItem } from '@/advanced-text-editor/extensions/slash-command/SlashCommand';
import { SettingsAiPromptVariableSuggestionMenu } from '@/settings/ai/system-prompt-overrides/components/SettingsAiPromptVariableSuggestionMenu';
import { type SlashCommandMenuProps } from '@/advanced-text-editor/extensions/slash-command/types/SlashCommandMenuProps';
import { AI_SYSTEM_PROMPT_VARIABLES } from '@/settings/ai/system-prompt-overrides/constants/AiSystemPromptVariables';
import { createSuggestionRenderLifecycle } from '@/ui/suggestion/components/createSuggestionRenderLifecycle';

export const getAiSystemPromptVariableSuggestionItems = (
  query: string,
): SlashCommandItem[] => {
  const normalizedQuery = query.trim().toLowerCase();

  return AI_SYSTEM_PROMPT_VARIABLES.map(
    ({ name, label, description }) =>
      ({
        id: name,
        title: i18n._(label),
        description: i18n._(description),
        icon: IconVariable,
        keywords: [name],
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertVariableTag(`{{${name}}}`)
            .run();
        },
      }) satisfies SlashCommandItem,
  ).filter(
    (item) =>
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery),
  );
};

export const AiSystemPromptVariableSuggestion = Extension.create({
  name: 'aiSystemPromptVariableSuggestion',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        pluginKey: new PluginKey('aiSystemPromptVariableSuggestion'),
        char: '{{',
        allowedPrefixes: null,
        items: ({ query }) => getAiSystemPromptVariableSuggestionItems(query),
        command: ({ editor, range, props }) => props.command({ editor, range }),
        render: () =>
          createSuggestionRenderLifecycle<
            SlashCommandItem,
            SlashCommandMenuProps
          >(
            {
              component: SettingsAiPromptVariableSuggestionMenu,
              getMenuProps: ({ items, onSelect, editor, range, query }) => ({
                items,
                onSelect,
                editor,
                range,
                query,
              }),
            },
            this.editor,
          ),
      }),
    ];
  },
});
