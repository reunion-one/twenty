import { isNonEmptyString } from '@sniptt/guards';
import { ToolCategory } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';
import {
  AI_SYSTEM_PROMPT_TOOL_CATEGORY_PATHS,
  TOOL_CATEGORY_WORDS,
} from 'src/engine/core-modules/tool-provider/constants/tool-catalog-prompt-template.constant';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';

export const buildToolCatalogVariables = (
  toolCatalog: ToolIndexEntry[],
  preloadedTools: readonly string[],
  discoveryToolNames: readonly string[] = [],
) => {
  const preloadedSet = new Set(preloadedTools);
  const group = (
    names: readonly string[],
    empty: string,
    isToolNameList = true,
  ) => {
    const uniqueNames = [...new Set(names)];
    return {
      list:
        uniqueNames.length === 0
          ? empty
          : uniqueNames
              .map(
                (name) =>
                  `- \`${name}\`${isToolNameList && preloadedSet.has(name) ? ' ✓' : ''}`,
              )
              .join('\n'),
      count: uniqueNames.length,
    };
  };
  const records = toolCatalog.filter(
    ({ category }) => category === ToolCategory.DATABASE_CRUD,
  );
  const patternedRecords = records.filter(
    ({ objectName, operation }) =>
      isNonEmptyString(objectName) && isNonEmptyString(operation),
  );
  const otherRecords = records.filter(
    ({ objectName, operation }) =>
      !isNonEmptyString(objectName) || !isNonEmptyString(operation),
  );
  const categories = Object.fromEntries(
    Object.values(ToolCategory).map((category) => [
      AI_SYSTEM_PROMPT_TOOL_CATEGORY_PATHS[category],
      group(
        toolCatalog
          .filter((tool) => tool.category === category)
          .map(({ name }) => name),
        `No ${TOOL_CATEGORY_WORDS[category]} tools are available.`,
      ),
    ]),
  );
  return {
    tools: {
      ...group(
        toolCatalog.map(({ name }) => name),
        'No tools are available.',
      ),
      ...categories,
      preloaded: group(preloadedTools, 'No tools are pre-loaded.'),
      discovery: group(discoveryToolNames, 'No discovery tools are available.'),
      record: {
        ...group(
          records.map(({ name }) => name),
          'No record tools are available.',
        ),
        patterns: group(
          patternedRecords.map(({ operation }) => `${operation}_{object}`),
          'No record operations are available.',
          false,
        ),
        other: group(
          otherRecords.map(({ name }) => name),
          'No other record tools are available.',
        ),
      },
    },
    objects: group(
      [
        ...new Set(
          patternedRecords
            .map(({ objectName }) => objectName)
            .filter(isDefined),
        ),
      ].sort(),
      'No objects are available.',
      false,
    ),
  };
};
