import { msg } from '@lingui/core/macro';
import { createHash } from 'node:crypto';
import { KeyValuePairType } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';
import { AiSystemPromptOverrideService } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/services/ai-system-prompt-override.service';
import { type AiSystemPromptOverrideValueMap } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/types/ai-system-prompt-override.type';
import { getAiSystemPromptDefaultTemplates } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/get-ai-system-prompt-default-templates.util';

describe('@custom AiSystemPromptOverrideService', () => {
  const keyValuePairService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };
  const service = new AiSystemPromptOverrideService(
    keyValuePairService as unknown as KeyValuePairService<AiSystemPromptOverrideValueMap>,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    keyValuePairService.get.mockResolvedValue([]);
  });

  it('rejects unknown sections including inherited property names', async () => {
    await expect(
      service.upsert('workspace', 'unknown', 'text'),
    ).rejects.toThrow('unknown');
    await expect(
      service.upsert('workspace', 'toString', 'text'),
    ).rejects.toThrow('toString');
    expect(keyValuePairService.set).not.toHaveBeenCalled();
  });

  it('rejects unknown variables after projection and unescaping', async () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '{{user.fistName}}' }],
        },
      ],
    });

    await expect(
      service.upsert('workspace', 'baseInstructions', content),
    ).rejects.toThrow('user.fistName');
    await expect(
      service.upsert(
        'workspace',
        'baseInstructions',
        String.raw`\{\{unknown\}\}`,
      ),
    ).rejects.toThrow('unknown');
    const names = 'user.fistName';

    await expect(
      service.upsert('workspace', 'baseInstructions', content),
    ).rejects.toMatchObject({
      extensions: { userFriendlyMessage: msg`Unknown variables: ${names}` },
    });
    expect(keyValuePairService.set).not.toHaveBeenCalled();
  });

  it('rejects the removed toolCatalog variable', async () => {
    await expect(
      service.upsert('workspace', 'toolCatalog', '{{toolCatalog}}'),
    ).rejects.toThrow('toolCatalog');
    expect(keyValuePairService.set).not.toHaveBeenCalled();
  });

  it('ignores unprefixed rows and unknown prefixed section keys', async () => {
    const value = { content: 'custom', defaultHash: 'hash' };

    keyValuePairService.get.mockResolvedValue([
      { key: 'responseFormat', value },
      { key: 'aiSystemPromptOverride:unknown', value },
      { key: 'aiSystemPromptOverride:responseFormat', value },
    ]);
    expect(await service.findOverrides('workspace')).toEqual(
      new Map([['responseFormat', value]]),
    );
    expect(keyValuePairService.get).toHaveBeenCalledWith({
      workspaceId: 'workspace',
      userId: null,
      type: KeyValuePairType.AI_SYSTEM_PROMPT_OVERRIDE,
    });
  });

  it('stores the original content and current template hash and detects changed defaults', async () => {
    const defaultHash = createHash('sha256')
      .update(getAiSystemPromptDefaultTemplates().baseInstructions)
      .digest('hex');

    const content = 'Custom {{tools.workflow.list}}';
    await service.upsert('workspace', 'baseInstructions', content);
    expect(keyValuePairService.set).toHaveBeenCalledWith({
      workspaceId: 'workspace',
      userId: null,
      type: KeyValuePairType.AI_SYSTEM_PROMPT_OVERRIDE,
      key: 'aiSystemPromptOverride:baseInstructions',
      value: { content, defaultHash },
    });
    keyValuePairService.get.mockResolvedValue([
      {
        key: 'aiSystemPromptOverride:baseInstructions',
        value: { content, defaultHash },
      },
      { key: 'aiSystemPromptOverride:unknown', value: {} },
    ]);
    expect(
      (await service.listSettingsSections('workspace')).find(
        (section) => section.sectionKey === 'baseInstructions',
      )?.isDefaultChanged,
    ).toBe(false);
    keyValuePairService.get.mockResolvedValue([
      {
        key: 'aiSystemPromptOverride:baseInstructions',
        value: { content: 'custom', defaultHash: 'old' },
      },
    ]);
    expect(
      (await service.listSettingsSections('workspace')).find(
        (section) => section.sectionKey === 'baseInstructions',
      )?.isDefaultChanged,
    ).toBe(true);
    expect(keyValuePairService.get).toHaveBeenCalledWith({
      workspaceId: 'workspace',
      userId: null,
      type: KeyValuePairType.AI_SYSTEM_PROMPT_OVERRIDE,
    });
  });

  it('keeps tag brackets as text in the editor default and leaves the hash on the raw default', async () => {
    keyValuePairService.get.mockResolvedValue([]);
    const section = (await service.listSettingsSections('workspace')).find(
      ({ sectionKey }) => sectionKey === 'browsingContext',
    );

    expect(section?.defaultTemplate).toContain(String.raw`\<browsing_context>`);
    await service.upsert('workspace', 'browsingContext', 'custom');
    expect(keyValuePairService.set).toHaveBeenCalledWith(
      expect.objectContaining({
        value: {
          content: 'custom',
          defaultHash: createHash('sha256')
            .update(getAiSystemPromptDefaultTemplates().browsingContext)
            .digest('hex'),
        },
      }),
    );
  });

  it('rejects deleting unknown sections before accessing storage', async () => {
    await expect(service.delete('workspace', 'unknown')).rejects.toThrow(
      'unknown',
    );
    await expect(service.delete('workspace', 'toString')).rejects.toThrow(
      'toString',
    );
    expect(keyValuePairService.delete).not.toHaveBeenCalled();
  });

  it('builds upstream sections with a stored override and resolves its variables', async () => {
    keyValuePairService.get.mockResolvedValue([
      {
        key: 'aiSystemPromptOverride:baseInstructions',
        value: {
          content: 'Hello {{user.firstName}} at {{workspace.name}}',
          defaultHash: 'hash',
        },
      },
    ]);
    const sections = await service.buildSections(
      {
        workspaceId: 'workspace',
        userWorkspaceId: 'user',
        toolCatalog: [],
        skillCatalog: [],
        preloadedTools: [],
        userContext: {
          firstName: 'Ada',
          lastName: '',
          jobTitle: null,
          timezone: null,
          locale: 'en',
        },
      },
      'Acme',
    );

    expect(
      sections.find((section) => section.title === 'Base Instructions')
        ?.content,
    ).toBe('Hello Ada at Acme');
    expect(
      sections.find((section) => section.title === 'Skill Catalog')?.content,
    ).toContain('No skills are available.');
    expect(keyValuePairService.get).toHaveBeenCalledWith({
      workspaceId: 'workspace',
      userId: null,
      type: KeyValuePairType.AI_SYSTEM_PROMPT_OVERRIDE,
    });
  });

  it('deletes only the workspace section override', async () => {
    await service.delete('workspace', 'baseInstructions');
    expect(keyValuePairService.delete).toHaveBeenCalledWith({
      workspaceId: 'workspace',
      userId: null,
      type: KeyValuePairType.AI_SYSTEM_PROMPT_OVERRIDE,
      key: 'aiSystemPromptOverride:baseInstructions',
    });
  });
});
