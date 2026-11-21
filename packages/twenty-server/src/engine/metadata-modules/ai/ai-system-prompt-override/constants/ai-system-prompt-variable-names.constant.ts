import { AI_SYSTEM_PROMPT_TOOL_CATEGORY_PATHS } from 'src/engine/core-modules/tool-provider/constants/tool-catalog-prompt-template.constant';

export const AI_SYSTEM_PROMPT_VARIABLE_NAMES: readonly string[] = [
  'assistant.displayName',
  'user.firstName',
  'user.lastName',
  'user.jobTitle',
  'user.locale',
  'user.timezone',
  'user.userWorkspaceId',
  'workspace.name',
  'workspace.id',
  'currentDate',
  ...[
    'tools',
    'tools.preloaded',
    'tools.discovery',
    'tools.record.patterns',
    'tools.record.other',
    'objects',
    'skills',
    ...Object.values(AI_SYSTEM_PROMPT_TOOL_CATEGORY_PATHS).map(
      (category) => `tools.${category}`,
    ),
  ].flatMap((group) => [`${group}.list`, `${group}.count`]),
];
