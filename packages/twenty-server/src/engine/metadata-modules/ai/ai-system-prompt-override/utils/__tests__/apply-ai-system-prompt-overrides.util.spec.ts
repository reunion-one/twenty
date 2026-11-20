import { tipTapDocumentToMarkdown } from 'twenty-shared/utils';
import { applyAiSystemPromptOverrides } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/apply-ai-system-prompt-overrides.util';
import { buildAiSystemPromptVariableContext } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/build-ai-system-prompt-variable-context.util';
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

describe('@custom applyAiSystemPromptOverrides', () => {
  it('replaces by title without adding omitted sections or mutating upstream blocks', () => {
    const sections = [
      { title: 'Tool Catalog', content: 'upstream tools' },
      { title: 'Base Instructions', content: 'base' },
    ];
    const context = buildAiSystemPromptVariableContext(args, sections, null);
    const result = applyAiSystemPromptOverrides(
      sections,
      new Map([
        ['toolCatalog', { content: 'new tools', defaultHash: '' }],
        [
          'baseInstructions',
          {
            content: document(
              '{{toolCatalog}} / {{skillCatalog}} / {{userContext}} / {{user.jobTitle}} / {{workspace.name}}',
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
      { title: 'Base Instructions', content: 'upstream tools /  /  /  / ' },
    ]);
    expect(sections[0].content).toBe('upstream tools');
  });

  it('normalizes null user fields and resolves scalar and upstream block variables', () => {
    const sections = [
      { title: 'User Context', content: 'original user' },
      { title: 'Skill Catalog', content: 'original skills' },
    ];
    const context = buildAiSystemPromptVariableContext(
      {
        ...args,
        userContext: {
          firstName: 'Ada',
          lastName: '',
          jobTitle: null,
          timezone: null,
          locale: 'en',
        },
      },
      sections,
      'Acme',
    );

    expect(context.user.jobTitle).toBe('');
    expect(context.user.timezone).toBe('');
    expect(
      applyAiSystemPromptOverrides(
        sections,
        new Map([
          [
            'userContext',
            {
              content:
                '{{user.firstName}} {{workspace.name}} {{skillCatalog}} {{userContext}}',
              defaultHash: '',
            },
          ],
        ]),
        context,
      )[0].content,
    ).toBe('Ada Acme original skills original user');
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
