import { getAiSystemPromptVariableSuggestionItems } from '@/settings/ai/system-prompt-overrides/extensions/AiSystemPromptVariableSuggestion';

describe('@custom AI system prompt variable suggestions', () => {
  it('filters by label and variable name without case sensitivity', () => {
    expect(
      getAiSystemPromptVariableSuggestionItems('first name').map(
        (item) => item.id,
      ),
    ).toEqual(['user.firstName']);
    expect(
      getAiSystemPromptVariableSuggestionItems('WORKSPACE.').map(
        (item) => item.id,
      ),
    ).toEqual(['workspace.name', 'workspace.id']);
    expect(
      getAiSystemPromptVariableSuggestionItems('workflow tools list').map(
        (item) => item.id,
      ),
    ).toEqual(['tools.workflow.list']);
    expect(getAiSystemPromptVariableSuggestionItems('unknown')).toEqual([]);
  });
});
