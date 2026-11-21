import { TOOL_CATALOG_TEMPLATE } from 'src/engine/core-modules/tool-provider/constants/tool-catalog-prompt-template.constant';
import { SKILL_CATALOG_TEMPLATE } from 'src/engine/metadata-modules/ai/ai-chat/constants/skill-catalog-prompt-template.constant';
import { USER_CONTEXT_TEMPLATE } from 'src/engine/metadata-modules/ai/ai-chat/constants/user-context-prompt-template.constant';
import { buildSystemPromptSections } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-system-prompt-sections.util';
import {
  AI_SYSTEM_PROMPT_EDITABLE_SECTIONS,
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
    toolCatalog: TOOL_CATALOG_TEMPLATE,
    skillCatalog: SKILL_CATALOG_TEMPLATE,
    userContext: USER_CONTEXT_TEMPLATE,
  };
};
