import { ToolCategory } from 'twenty-shared/ai';
import { tipTapDocumentToMarkdown } from 'twenty-shared/utils';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { applyAiSystemPromptOverrides } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/apply-ai-system-prompt-overrides.util';
import { buildAiSystemPromptVariableContext } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/build-ai-system-prompt-variable-context.util';
import { resolveAiSystemPromptPreviewToolNames } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/resolve-ai-system-prompt-preview-tool-names.util';
import { unescapeMarkdownText } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/unescape-markdown-text.util';

const args = {
  toolCatalog: [],
  skillCatalog: [],
  preloadedTools: [],
  workspaceId: 'workspace',
  userWorkspaceId: 'user',
};
const document = (text: string) =>
  JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });

const tool = (
  name: string,
  category: ToolCategory,
  record?: Pick<ToolIndexEntry, 'objectName' | 'operation'>,
): ToolIndexEntry => ({
  name,
  label: name,
  description: '',
  category,
  executionRef: { kind: 'static', toolId: name },
  ...record,
});

describe('@custom applyAiSystemPromptOverrides', () => {
  it('replaces by title without adding omitted sections or mutating upstream blocks', () => {
    const sections = [
      { title: 'Tool Catalog', content: 'upstream tools' },
      { title: 'Base Instructions', content: 'base' },
    ];
    const context = buildAiSystemPromptVariableContext(args, null);
    const result = applyAiSystemPromptOverrides(
      sections,
      new Map([
        ['toolCatalog', { content: 'new tools', defaultHash: '' }],
        [
          'baseInstructions',
          {
            content: document(
              '{{tools.list}} / {{skills.list}} / {{user.timezone}} / {{user.jobTitle}} / {{workspace.name}}',
            ),
            defaultHash: '',
          },
        ],
        ['conversationAttachment', { content: 'missing', defaultHash: '' }],
      ]),
      context,
    );

    expect(result).toEqual([
      { title: 'Tool Catalog', content: 'new tools' },
      {
        title: 'Base Instructions',
        content:
          'No tools are available. / No skills are available. / Not set / Not set / ',
      },
    ]);
    expect(sections[0].content).toBe('upstream tools');
  });

  it('normalizes null user fields and resolves scalar and catalog variables', () => {
    const sections = [
      { title: 'User Context', content: 'original user' },
      { title: 'Skill Catalog', content: 'original skills' },
    ];
    const context = buildAiSystemPromptVariableContext(
      {
        ...args,
        userContext: {
          firstName: 'Sam',
          lastName: '',
          jobTitle: null,
          timezone: null,
          locale: 'en',
        },
      },
      'Acme',
    );

    expect(context.user.jobTitle).toBe('Not set');
    expect(context.user.timezone).toBe('Not set');
    expect(
      applyAiSystemPromptOverrides(
        sections,
        new Map([
          [
            'userContext',
            {
              content:
                '{{user.firstName}} {{workspace.name}} {{skills.count}} {{user.timezone}}',
              defaultHash: '',
            },
          ],
        ]),
        context,
      )[0].content,
    ).toBe('Sam Acme 0 Not set');
  });

  it('renders scoped registry lists, operation patterns, skills and tool loading separately', () => {
    const sections = [{ title: 'Base Instructions', content: 'default' }];
    const context = buildAiSystemPromptVariableContext(
      {
        ...args,
        preloadedTools: ['read_file'],
        toolCatalog: [
          tool('list_workflows', ToolCategory.WORKFLOW),
          tool('find_many_people', ToolCategory.DATABASE_CRUD, {
            objectName: 'person',
            operation: 'find_many',
          }),
          tool('read_file', ToolCategory.ACTION),
        ],
        skillCatalog: [
          {
            id: 'skill',
            universalIdentifier: 'skill',
            workspaceId: 'workspace',
            applicationId: 'application',
            applicationUniversalIdentifier: 'application',
            name: 'clean-data',
            label: 'Clean data',
            description: null,
            icon: null,
            content: '',
            isActive: true,
            isSystem: false,
            isCustom: false,
            overrides: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      null,
      { availableToolNames: ['learn_tools', 'read_file'] },
    );

    expect(
      applyAiSystemPromptOverrides(
        sections,
        new Map([
          [
            'baseInstructions',
            {
              content: document(
                '{{objects.count}} {{objects.list}} / {{tools.count}} {{tools.list}} / {{tools.workflow.list}} / {{tools.logicFunction.list}} / {{tools.record.patterns.list}} / {{tools.preloaded.list}} / {{tools.discovery.list}} / {{skills.count}} {{skills.list}}',
              ),
              defaultHash: '',
            },
          ],
        ]),
        context,
      )[0].content,
    ).toBe(
      '1 - `person` / 3 - `list_workflows`\n- `find_many_people`\n- `read_file` ✓ / - `list_workflows` / No logic function tools are available. / - `find_many_{object}` / - `read_file` ✓ / - `learn_tools` / 1 - `clean-data`: Clean data',
    );
  });

  it('previews only eligible registry preloads with a resolved schema', async () => {
    const toolCatalog = [
      tool('search_help_center', ToolCategory.ACTION),
      tool('app_exa_web_search', ToolCategory.LOGIC_FUNCTION),
    ];
    const context = { workspaceId: 'workspace' };
    const resolveSchemas = jest
      .fn()
      .mockResolvedValue(new Map([['search_help_center', { type: 'object' }]]));

    const previewToolNames = await resolveAiSystemPromptPreviewToolNames({
      toolRegistry: { resolveSchemas },
      context,
      toolCatalog,
      preloadedToolNames: [
        'search_help_center',
        'app_exa_web_search',
        'read_file',
      ],
    });

    expect(previewToolNames.directToolNames).toEqual(['search_help_center']);
    expect(resolveSchemas).toHaveBeenCalledWith({
      context,
      precomputedCatalog: toolCatalog,
      toolNames: ['search_help_center', 'app_exa_web_search'],
    });
  });

  it('reverses converter escapes including line-start punctuation', () => {
    const text = [
      '\\ ` * _ [ ] { } < > ~ | # &',
      '> quote',
      '- item',
      '+ item',
      '1. item',
      '2) item',
    ].join('\n');

    expect(unescapeMarkdownText(tipTapDocumentToMarkdown(document(text)))).toBe(
      text,
    );
  });

  it('unescapes literal escaped braces before resolving variables', () => {
    const content = String.raw`\{\{x\}\}`;

    expect(unescapeMarkdownText(content)).toBe('{{x}}');
    expect(
      applyAiSystemPromptOverrides(
        [{ title: 'Base Instructions', content: '' }],
        new Map([['baseInstructions', { content, defaultHash: '' }]]),
        { x: 'resolved' },
      )[0].content,
    ).toBe('resolved');
  });
});
