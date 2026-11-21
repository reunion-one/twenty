import { ToolCategory } from 'twenty-shared/ai';
import { resolveStringTemplate } from 'twenty-shared/utils';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { buildToolCatalogVariables } from 'src/engine/core-modules/tool-provider/utils/build-tool-catalog-variables.util';
import { buildSkillCatalogVariables } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-skill-catalog-variables.util';
import { buildUserContextVariables } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-user-context-variables.util';

const tool = (
  name: string,
  category: ToolCategory,
  objectName?: string,
  operation?: string,
): ToolIndexEntry => ({
  name,
  label: name,
  description: '',
  category,
  objectName,
  operation,
  executionRef: { kind: 'static', toolId: name },
});

describe('@custom buildToolCatalogVariables', () => {
  const catalog = [
    tool('z_action', ToolCategory.ACTION),
    tool('find_one_person', ToolCategory.DATABASE_CRUD, 'person', 'find_one'),
    tool(
      'find_many_companies',
      ToolCategory.DATABASE_CRUD,
      'company',
      'find_many',
    ),
    tool('find_one_company', ToolCategory.DATABASE_CRUD, 'company', 'find_one'),
    tool('inspect_records', ToolCategory.DATABASE_CRUD),
    tool('a_action', ToolCategory.ACTION),
    tool('z_action', ToolCategory.ACTION),
  ];
  const variables = buildToolCatalogVariables(
    catalog,
    ['z_action', 'inspect_records', 'z_action'],
    ['learn_tools', 'learn_tools'],
  );

  it('counts unique names in registry order and splits record data', () => {
    expect(variables.tools.count).toBe(6);
    expect(variables.tools.list).toBe(
      '- `z_action` ✓\n- `find_one_person`\n- `find_many_companies`\n- `find_one_company`\n- `inspect_records` ✓\n- `a_action`',
    );
    expect(variables.tools.preloaded).toEqual({
      list: '- `z_action` ✓\n- `inspect_records` ✓',
      count: 2,
    });
    expect(variables.tools.discovery).toEqual({
      list: '- `learn_tools`',
      count: 1,
    });
    expect(variables.tools.record.count).toBe(4);
    expect(variables.tools.record.patterns).toEqual({
      list: '- `find_one_{object}`\n- `find_many_{object}`',
      count: 2,
    });
    expect(variables.tools.record.other).toEqual({
      list: '- `inspect_records` ✓',
      count: 1,
    });
    expect(variables.objects).toEqual({
      list: '- `company`\n- `person`',
      count: 2,
    });
    expect(
      resolveStringTemplate(
        '{{tools.action.list}} / {{tools.action.count}}',
        variables,
      ),
    ).toBe('- `z_action` ✓\n- `a_action` / 2');
  });

  const emptyVariables = {
    ...buildToolCatalogVariables([], []),
    ...buildSkillCatalogVariables([]),
  };
  it.each([
    ['tools', 'No tools are available.'],
    ['tools.preloaded', 'No tools are pre-loaded.'],
    ['tools.discovery', 'No discovery tools are available.'],
    ['tools.record.patterns', 'No record operations are available.'],
    ['tools.record.other', 'No other record tools are available.'],
    ['objects', 'No objects are available.'],
    ['skills', 'No skills are available.'],
    ['tools.workflow', 'No workflow tools are available.'],
    ['tools.pageLayout', 'No page layout tools are available.'],
  ])('renders the empty sentence for %s with count zero', (path, sentence) => {
    expect(
      resolveStringTemplate(
        `{{${path}.list}} / {{${path}.count}}`,
        emptyVariables,
      ),
    ).toBe(`${sentence} / 0`);
  });

  it('normalizes invalid timezone and empty optional user fields', () => {
    expect(
      buildUserContextVariables({
        firstName: 'Sam',
        lastName: '',
        jobTitle: '',
        locale: 'en',
        timezone: 'invalid',
      }).user,
    ).toEqual({
      firstName: 'Sam',
      lastName: '',
      jobTitle: 'Not set',
      locale: 'en',
      timezone: 'Not set',
    });
  });
});
