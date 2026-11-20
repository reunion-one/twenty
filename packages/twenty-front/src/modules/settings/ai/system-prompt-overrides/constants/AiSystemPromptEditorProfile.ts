import { VariableTag } from '@/advanced-text-editor/extensions/variable-tag/VariableTag';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SettingsAiPromptVariableTagChip } from '@/settings/ai/system-prompt-overrides/components/SettingsAiPromptVariableTagChip';
import { type AdvancedTextEditorExtensionContext } from '@/advanced-text-editor/types/AdvancedTextEditorExtensionContext';
import { AiSystemPromptVariableSuggestion } from '@/settings/ai/system-prompt-overrides/extensions/AiSystemPromptVariableSuggestion';
import { AI_INSTRUCTIONS_EDITOR_PROFILE } from '@/ai/constants/AiInstructionsEditorProfile';
import { parseLegacyMarkdownDocumentWithVariables } from '@/advanced-text-editor/utils/parseLegacyMarkdownDocumentWithVariables';

export const AI_SYSTEM_PROMPT_EDITOR_PROFILE = {
  ...AI_INSTRUCTIONS_EDITOR_PROFILE,
  buildExtensions: (context: AdvancedTextEditorExtensionContext) => [
    ...AI_INSTRUCTIONS_EDITOR_PROFILE.buildExtensions(context).filter(
      (extension) => extension.name !== 'variableTag',
    ),
    VariableTag.extend({
      addNodeView: () => ReactNodeViewRenderer(SettingsAiPromptVariableTagChip),
    }),
    AiSystemPromptVariableSuggestion,
  ],
  parseLegacyDocument: parseLegacyMarkdownDocumentWithVariables,
};
