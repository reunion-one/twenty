import { DEFAULT_AI_CHAT_ASSISTANT_PROFILE } from 'twenty-shared/ai';
import { type BuildSystemPromptArguments } from 'src/engine/metadata-modules/ai/ai-chat/types/build-system-prompt-arguments.type';
import { buildUserContextVariables } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-user-context-variables.util';
import {
  buildAiSystemPromptCatalogVariables,
  type AiSystemPromptToolNames,
} from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/build-ai-system-prompt-catalog-variables.util';

export const buildAiSystemPromptVariableContext = (
  args: BuildSystemPromptArguments,
  workspaceName?: string | null,
  toolNames?: AiSystemPromptToolNames,
) => {
  const userVariables = buildUserContextVariables(args.userContext);
  return {
    ...buildAiSystemPromptCatalogVariables(args, toolNames),
    ...userVariables,
    assistant: {
      displayName:
        args.assistantDisplayName ??
        DEFAULT_AI_CHAT_ASSISTANT_PROFILE.displayName,
    },
    user: {
      ...userVariables.user,
      userWorkspaceId: args.userWorkspaceId ?? '',
    },
    workspace: { name: workspaceName ?? '', id: args.workspaceId ?? '' },
  };
};
