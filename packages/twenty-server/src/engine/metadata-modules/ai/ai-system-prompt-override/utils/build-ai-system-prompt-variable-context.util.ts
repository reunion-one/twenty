import { AI_SYSTEM_PROMPT_EDITABLE_SECTIONS } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-editable-sections.constant';
import { getValidTimeZoneOrUndefined } from 'twenty-shared/utils';
import { DEFAULT_AI_CHAT_ASSISTANT_PROFILE } from 'twenty-shared/ai';
import { type BuildSystemPromptArguments } from 'src/engine/metadata-modules/ai/ai-chat/types/build-system-prompt-arguments.type';
import { type SystemPromptSection } from 'src/engine/metadata-modules/ai/ai-chat/types/system-prompt-section.type';

import {
  buildAiSystemPromptCatalogVariables,
  type AiSystemPromptToolNames,
} from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/build-ai-system-prompt-catalog-variables.util';

export const buildAiSystemPromptVariableContext = (
  args: BuildSystemPromptArguments,
  sections: SystemPromptSection[],
  workspaceName?: string | null,
  toolNames?: AiSystemPromptToolNames,
) => ({
  ...buildAiSystemPromptCatalogVariables(args, toolNames),
  assistant: {
    displayName:
      args.assistantDisplayName ??
      DEFAULT_AI_CHAT_ASSISTANT_PROFILE.displayName,
  },
  user: {
    firstName: args.userContext?.firstName ?? '',
    lastName: args.userContext?.lastName ?? '',
    jobTitle: args.userContext?.jobTitle ?? '',
    locale: args.userContext?.locale ?? '',
    timezone: args.userContext?.timezone ?? '',
    userWorkspaceId: args.userWorkspaceId ?? '',
  },
  workspace: { name: workspaceName ?? '', id: args.workspaceId ?? '' },
  currentDate: new Intl.DateTimeFormat('en-US', {
    timeZone: getValidTimeZoneOrUndefined(args.userContext?.timezone),
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date()),
  toolCatalog:
    sections.find(
      (section) =>
        section.title === AI_SYSTEM_PROMPT_EDITABLE_SECTIONS.toolCatalog,
    )?.content ?? '',
  skillCatalog:
    sections.find(
      (section) =>
        section.title === AI_SYSTEM_PROMPT_EDITABLE_SECTIONS.skillCatalog,
    )?.content ?? '',
  userContext:
    sections.find(
      (section) =>
        section.title === AI_SYSTEM_PROMPT_EDITABLE_SECTIONS.userContext,
    )?.content ?? '',
});
