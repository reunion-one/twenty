import { buildToolCatalogVariables } from 'src/engine/core-modules/tool-provider/utils/build-tool-catalog-variables.util';
import { type BuildSystemPromptArguments } from 'src/engine/metadata-modules/ai/ai-chat/types/build-system-prompt-arguments.type';
import { buildSkillCatalogVariables } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-skill-catalog-variables.util';
import { AI_SYSTEM_PROMPT_DISCOVERY_TOOL_NAMES } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-discovery-tool-names.constant';

export type AiSystemPromptToolNames = {
  availableToolNames?: readonly string[];
};

export const buildAiSystemPromptCatalogVariables = (
  { toolCatalog, skillCatalog, preloadedTools }: BuildSystemPromptArguments,
  { availableToolNames = [] }: AiSystemPromptToolNames = {},
) => ({
  ...buildToolCatalogVariables(
    toolCatalog,
    preloadedTools,
    AI_SYSTEM_PROMPT_DISCOVERY_TOOL_NAMES.filter((name) =>
      availableToolNames.includes(name),
    ),
  ),
  ...buildSkillCatalogVariables(skillCatalog),
});
