import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { ToolCategory } from 'twenty-shared/ai';
import { type BuildSystemPromptArguments } from 'src/engine/metadata-modules/ai/ai-chat/types/build-system-prompt-arguments.type';
import { buildSystemPromptSections } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-system-prompt-sections.util';
import { KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';
import { AI_SYSTEM_PROMPT_EDITABLE_SECTIONS } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-editable-sections.constant';
import { AiSystemPromptOverrideService } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/services/ai-system-prompt-override.service';
import { type AiSystemPromptOverrideValueMap } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/types/ai-system-prompt-override.type';
import { getAiSystemPromptDefaultTemplates } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/get-ai-system-prompt-default-templates.util';

describe('@custom editable system prompt upgrade guard', () => {
  it('keeps all mapped titles in upstream output with full arguments', () => {
    const args = {
      workspaceId: 'workspace',
      userWorkspaceId: 'user',
      preloadedTools: [],
      canAttachConversationToRecords: true,
      toolCatalog: [
        {
          name: 'search',
          label: 'Search',
          description: 'Search records',
          category: ToolCategory.FRONT_COMPONENT,
          executionRef: { kind: 'static', toolId: 'search' },
        },
      ],
      skillCatalog: [
        {
          name: 'research',
          label: 'Research',
          description: 'Research records',
        } as FlatSkill,
      ],
      userContext: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        jobTitle: null,
        locale: 'en',
        timezone: 'UTC',
      },
    } as BuildSystemPromptArguments;
    const titles = buildSystemPromptSections(args).map(
      (section) => section.title,
    );

    for (const title of Object.values(AI_SYSTEM_PROMPT_EDITABLE_SECTIONS)) {
      expect(titles).toContain(title);
    }
  });

  it('accepts every default template through save validation', async () => {
    const keyValuePairService = { set: jest.fn() };
    const service = new AiSystemPromptOverrideService(
      keyValuePairService as unknown as KeyValuePairService<AiSystemPromptOverrideValueMap>,
    );

    for (const [key, template] of Object.entries(
      getAiSystemPromptDefaultTemplates(),
    )) {
      expect(template.length).toBeGreaterThan(0);
      await expect(
        service.upsert('workspace', key, template),
      ).resolves.toBeUndefined();
    }
    expect(keyValuePairService.set).toHaveBeenCalledTimes(8);
  });
});
