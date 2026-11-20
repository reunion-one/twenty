import {
  isDefined,
  resolveStringTemplate,
  tipTapDocumentToMarkdown,
} from 'twenty-shared/utils';
import { type SystemPromptSection } from 'src/engine/metadata-modules/ai/ai-chat/types/system-prompt-section.type';
import {
  AI_SYSTEM_PROMPT_EDITABLE_SECTIONS,
  type AiSystemPromptSectionKey,
} from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-editable-sections.constant';
import { type AiSystemPromptOverride } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/types/ai-system-prompt-override.type';
import { unescapeMarkdownText } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/unescape-markdown-text.util';

export const applyAiSystemPromptOverrides = (
  sections: SystemPromptSection[],
  overridesByKey: Map<AiSystemPromptSectionKey, AiSystemPromptOverride>,
  context: Record<string, unknown>,
): SystemPromptSection[] =>
  sections.map((section) => {
    const sectionKey = (
      Object.keys(
        AI_SYSTEM_PROMPT_EDITABLE_SECTIONS,
      ) as AiSystemPromptSectionKey[]
    ).find((key) => AI_SYSTEM_PROMPT_EDITABLE_SECTIONS[key] === section.title);
    const override = isDefined(sectionKey)
      ? overridesByKey.get(sectionKey)
      : undefined;

    return isDefined(override)
      ? {
          ...section,
          content: resolveStringTemplate(
            unescapeMarkdownText(tipTapDocumentToMarkdown(override.content)),
            context,
          ),
        }
      : section;
  });
