import { AI_SYSTEM_PROMPT_VARIABLE_NAMES } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-variable-names.constant';
import { buildAiSystemPromptVariableContext } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/build-ai-system-prompt-variable-context.util';

const flattenKeys = (context: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(context).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });

describe('@custom AI_SYSTEM_PROMPT_VARIABLE_NAMES', () => {
  it('matches the fifty context leaves and excludes removed blocks', () => {
    const context = buildAiSystemPromptVariableContext({
      toolCatalog: [],
      skillCatalog: [],
      preloadedTools: [],
      workspaceId: 'workspace',
      userWorkspaceId: 'user',
    });
    expect(AI_SYSTEM_PROMPT_VARIABLE_NAMES).toHaveLength(50);
    expect([...AI_SYSTEM_PROMPT_VARIABLE_NAMES].sort()).toEqual(
      flattenKeys(context).sort(),
    );
    for (const name of ['toolCatalog', 'skillCatalog', 'userContext']) {
      expect(AI_SYSTEM_PROMPT_VARIABLE_NAMES).not.toContain(name);
    }
  });
});
