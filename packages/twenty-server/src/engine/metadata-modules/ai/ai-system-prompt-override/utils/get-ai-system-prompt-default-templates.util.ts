import { buildSystemPromptSections } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-system-prompt-sections.util';
import {
  AI_SYSTEM_PROMPT_EDITABLE_SECTIONS,
  AI_SYSTEM_PROMPT_BLOCK_DEFAULTS,
  type AiSystemPromptSectionKey,
} from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-editable-sections.constant';

export const getAiSystemPromptDefaultTemplates = (): Record<
  AiSystemPromptSectionKey,
  string
> => {
  const sections = buildSystemPromptSections({
    assistantDisplayName: '{{assistant.displayName}}',
    userWorkspaceId: '{{user.userWorkspaceId}}',
    workspaceId: '',
    toolCatalog: [],
    skillCatalog: [],
    preloadedTools: [],
    canAttachConversationToRecords: true,
  });

  return {
    ...(Object.fromEntries(
      Object.entries(AI_SYSTEM_PROMPT_EDITABLE_SECTIONS).map(([key, title]) => [
        key,
        sections.find((section) => section.title === title)?.content ?? '',
      ]),
    ) as Record<AiSystemPromptSectionKey, string>),
    ...AI_SYSTEM_PROMPT_BLOCK_DEFAULTS,
  };
};
