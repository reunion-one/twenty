import { AI_SYSTEM_PROMPT_VARIABLES } from '@/settings/ai/system-prompt-overrides/constants/AiSystemPromptVariables';

describe('@custom AI system prompt variables', () => {
  it('matches the fifty server variable names without duplicates or removed blocks', () => {
    const names = AI_SYSTEM_PROMPT_VARIABLES.map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
    // This literal list guards against drift from the server variable allowlist.
    expect([...names].sort()).toEqual([
      'assistant.displayName',
      'currentDate',
      'objects.count',
      'objects.list',
      'skills.count',
      'skills.list',
      'tools.action.count',
      'tools.action.list',
      'tools.agent.count',
      'tools.agent.list',
      'tools.count',
      'tools.discovery.count',
      'tools.discovery.list',
      'tools.frontComponent.count',
      'tools.frontComponent.list',
      'tools.list',
      'tools.logicFunction.count',
      'tools.logicFunction.list',
      'tools.mcp.count',
      'tools.mcp.list',
      'tools.metadata.count',
      'tools.metadata.list',
      'tools.navigationMenuItem.count',
      'tools.navigationMenuItem.list',
      'tools.pageLayout.count',
      'tools.pageLayout.list',
      'tools.preloaded.count',
      'tools.preloaded.list',
      'tools.record.count',
      'tools.record.list',
      'tools.record.other.count',
      'tools.record.other.list',
      'tools.record.patterns.count',
      'tools.record.patterns.list',
      'tools.role.count',
      'tools.role.list',
      'tools.view.count',
      'tools.view.list',
      'tools.webhook.count',
      'tools.webhook.list',
      'tools.workflow.count',
      'tools.workflow.list',
      'user.firstName',
      'user.jobTitle',
      'user.lastName',
      'user.locale',
      'user.timezone',
      'user.userWorkspaceId',
      'workspace.id',
      'workspace.name',
    ]);
    for (const name of ['toolCatalog', 'skillCatalog', 'userContext']) {
      expect(names).not.toContain(name);
    }
  });
});
