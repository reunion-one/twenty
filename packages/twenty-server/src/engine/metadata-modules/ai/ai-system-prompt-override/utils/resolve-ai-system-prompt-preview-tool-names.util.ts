import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { AI_SYSTEM_PROMPT_DISCOVERY_TOOL_NAMES } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-discovery-tool-names.constant';

export const resolveAiSystemPromptPreviewToolNames = async ({
  toolRegistry,
  context,
  toolCatalog,
  preloadedToolNames,
}: {
  toolRegistry: Pick<ToolRegistryService, 'resolveSchemas'>;
  context: ToolProviderContext;
  toolCatalog: ToolIndexEntry[];
  preloadedToolNames: readonly string[];
}) => {
  const catalogNames = new Set(toolCatalog.map(({ name }) => name));
  const toolNames = preloadedToolNames.filter((name) => catalogNames.has(name));
  const schemas = toolNames.length
    ? await toolRegistry.resolveSchemas({
        toolNames,
        context,
        precomputedCatalog: toolCatalog,
      })
    : new Map();

  return {
    directToolNames: toolNames.filter((name) => schemas.has(name)),
    availableToolNames: AI_SYSTEM_PROMPT_DISCOVERY_TOOL_NAMES,
  };
};
