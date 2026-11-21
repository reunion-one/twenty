import { ToolCategory } from 'twenty-shared/ai';

import { type BuildSystemPromptArguments } from 'src/engine/metadata-modules/ai/ai-chat/types/build-system-prompt-arguments.type';
import { AI_SYSTEM_PROMPT_DISCOVERY_TOOL_NAMES } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-discovery-tool-names.constant';
import { AI_SYSTEM_PROMPT_TOOL_CATEGORY_PATHS } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-tool-category-paths.constant';

export type AiSystemPromptToolNames = {
  directToolNames?: readonly string[];
  availableToolNames?: readonly string[];
};

const sortedUnique = (names: readonly string[]) => [...new Set(names)].sort();

const formatNames = (names: readonly string[]) =>
  names.map((name) => `- \`${name}\``).join('\n');

export const buildAiSystemPromptCatalogVariables = (
  { toolCatalog, skillCatalog, preloadedTools }: BuildSystemPromptArguments,
  {
    directToolNames = preloadedTools,
    availableToolNames = [],
  }: AiSystemPromptToolNames = {},
) => {
  const toolNames = sortedUnique(toolCatalog.map(({ name }) => name));
  const objectNames = new Set<string>();
  const recordPatterns = new Set<string>();
  const namesByCategory = new Map<ToolCategory, string[]>();

  for (const { category, name, objectName, operation } of toolCatalog) {
    const categoryNames = namesByCategory.get(category) ?? [];
    categoryNames.push(name);
    namesByCategory.set(category, categoryNames);

    if (category === ToolCategory.DATABASE_CRUD && objectName && operation) {
      objectNames.add(objectName);
      recordPatterns.add(`${operation}_{object}`);
    }
  }

  const toolCategories = Object.values(ToolCategory).map(
    (category) =>
      [
        AI_SYSTEM_PROMPT_TOOL_CATEGORY_PATHS[category],
        {
          names: formatNames(sortedUnique(namesByCategory.get(category) ?? [])),
        },
      ] as const,
  );
  const skillsByName = new Map(
    skillCatalog.map((skill) => [skill.name, skill.description ?? skill.label]),
  );
  const skillNames = [...skillsByName.keys()].sort();

  return {
    objects: {
      names: formatNames([...objectNames].sort()),
      count: objectNames.size,
    },
    tools: {
      ...Object.fromEntries(toolCategories),
      names: formatNames(toolNames),
      count: toolNames.length,
      direct: { names: formatNames(sortedUnique(directToolNames)) },
      discovery: {
        names: formatNames(
          sortedUnique(
            AI_SYSTEM_PROMPT_DISCOVERY_TOOL_NAMES.filter((name) =>
              availableToolNames.includes(name),
            ),
          ),
        ),
      },
      record: {
        names: formatNames(
          sortedUnique(namesByCategory.get(ToolCategory.DATABASE_CRUD) ?? []),
        ),
        patterns: formatNames([...recordPatterns].sort()),
      },
    },
    skills: {
      names: formatNames(skillNames),
      summaries: skillNames
        .map((name) => `- \`${name}\`: ${skillsByName.get(name)}`)
        .join('\n'),
      count: skillNames.length,
    },
  };
};
