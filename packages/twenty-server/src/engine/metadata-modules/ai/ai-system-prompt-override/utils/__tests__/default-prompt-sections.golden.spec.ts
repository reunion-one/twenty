import { ToolCategory } from 'twenty-shared/ai';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { buildToolCatalogSection } from 'src/engine/core-modules/tool-provider/utils/build-tool-catalog-section.util';
import { buildSkillCatalogSection } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-skill-catalog-section.util';
import { buildUserContextSection } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-user-context-section.util';
import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';

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
const catalog = [
  tool(
    'find_many_companies',
    ToolCategory.DATABASE_CRUD,
    'company',
    'find_many',
  ),
  tool('find_one_company', ToolCategory.DATABASE_CRUD, 'company', 'find_one'),
  tool(
    'create_one_company',
    ToolCategory.DATABASE_CRUD,
    'company',
    'create_one',
  ),
  tool('find_many_people', ToolCategory.DATABASE_CRUD, 'person', 'find_many'),
  tool('find_one_person', ToolCategory.DATABASE_CRUD, 'person', 'find_one'),
  tool('create_one_person', ToolCategory.DATABASE_CRUD, 'person', 'create_one'),
  tool('inspect_records', ToolCategory.DATABASE_CRUD),
  tool('action_tool', ToolCategory.ACTION),
  tool('workflow_tool', ToolCategory.WORKFLOW),
  tool('metadata_tool', ToolCategory.METADATA),
  tool('view_tool', ToolCategory.VIEW),
  tool('front_component_tool', ToolCategory.FRONT_COMPONENT),
  tool('page_layout_tool', ToolCategory.PAGE_LAYOUT),
  tool('navigation_menu_item_tool', ToolCategory.NAVIGATION_MENU_ITEM),
  tool('webhook_tool', ToolCategory.WEBHOOK),
  tool('logic_function_tool', ToolCategory.LOGIC_FUNCTION),
  tool('role_tool', ToolCategory.ROLE),
  tool('agent_tool', ToolCategory.AGENT),
  tool('mcp_tool', ToolCategory.MCP),
];

describe('@custom default prompt sections golden', () => {
  // Revision 2 adds the preload count, removes the record example and no longer lists record tools without an object.
  it('renders every category and record sub-block', () => {
    expect(buildToolCatalogSection(catalog, ['action_tool', 'inspect_records']))
      .toBe(`
## Available Tools

You have access to 19 tools. Some are pre-loaded and ready to use immediately.
To use any other tool, first call \`learn_tools\` to learn its schema, then call \`execute_tool\` to run it.

### Pre-loaded Tools (ready to use now 2)
- \`action_tool\` ✓
- \`inspect_records\` ✓

### Tool Catalog by Category

#### Database Tools (CRUD operations) (7 tools)
Operations per object:
- \`find_many_{object}\`
- \`find_one_{object}\`
- \`create_one_{object}\`

Objects (2):
- \`company\`
- \`person\`

Tool name = operation + object name. *_many_* operations use the plural form, *_one_* use the singular form.

#### Action Tools (HTTP, Email, etc.) (1 tools)
- \`action_tool\` ✓

#### Workflow Tools (create/manage workflows) (1 tools)
- \`workflow_tool\`

#### Metadata Tools (schema management) (1 tools)
- \`metadata_tool\`

#### View Tools (manage views, fields, filters, and sorts) (1 tools)
- \`view_tool\`

#### Frontend Components (preview and save Workspace components) (1 tools)
- \`front_component_tool\`

#### Page Layout Tools (manage dashboards, tabs and widgets, and place components on dashboard or record pages) (1 tools)
- \`page_layout_tool\`

#### Navigation Menu Item Tools (sidebar entries, folders, and user favorites) (1 tools)
- \`navigation_menu_item_tool\`

#### Webhook Tools (outgoing webhooks) (1 tools)
- \`webhook_tool\`

#### Logic Functions (custom tools) (1 tools)
- \`logic_function_tool\`

#### Role Tools (manage roles and permissions) (1 tools)
- \`role_tool\`

#### Agent Tools (create/manage AI agents and their triggers) (1 tools)
- \`agent_tool\`

#### MCP Server Tools (external tools, grouped by server) (1 tools)
- \`mcp_tool\`

### How to Use Tools
1. **Pre-loaded tools** (marked with ✓): Use directly
2. **Other tools**: First call \`learn_tools({toolNames: ["tool_name"]})\` to learn the schema, then call \`execute_tool({toolName: "tool_name", arguments: {...}})\` to run it`);
  });
  // Revision 2.1 keeps empty category headings and their empty-state sentences.
  it('renders the agent-run catalog without preloads', () => {
    const agentCatalog = catalog.filter((entry) =>
      [
        ToolCategory.DATABASE_CRUD,
        ToolCategory.ACTION,
        ToolCategory.PAGE_LAYOUT,
        ToolCategory.WORKFLOW,
      ].includes(entry.category),
    );
    expect(buildToolCatalogSection(agentCatalog, [])).toBe(`
## Available Tools

You have access to 10 tools. Some are pre-loaded and ready to use immediately.
To use any other tool, first call \`learn_tools\` to learn its schema, then call \`execute_tool\` to run it.

### Pre-loaded Tools (ready to use now 0)
No tools are pre-loaded.

### Tool Catalog by Category

#### Database Tools (CRUD operations) (7 tools)
Operations per object:
- \`find_many_{object}\`
- \`find_one_{object}\`
- \`create_one_{object}\`

Objects (2):
- \`company\`
- \`person\`

Tool name = operation + object name. *_many_* operations use the plural form, *_one_* use the singular form.

#### Action Tools (HTTP, Email, etc.) (1 tools)
- \`action_tool\`

#### Workflow Tools (create/manage workflows) (1 tools)
- \`workflow_tool\`

#### Metadata Tools (schema management) (0 tools)
No metadata tools are available.

#### View Tools (manage views, fields, filters, and sorts) (0 tools)
No view tools are available.

#### Frontend Components (preview and save Workspace components) (0 tools)
No front component tools are available.

#### Page Layout Tools (manage dashboards, tabs and widgets, and place components on dashboard or record pages) (1 tools)
- \`page_layout_tool\`

#### Navigation Menu Item Tools (sidebar entries, folders, and user favorites) (0 tools)
No navigation menu item tools are available.

#### Webhook Tools (outgoing webhooks) (0 tools)
No webhook tools are available.

#### Logic Functions (custom tools) (0 tools)
No logic function tools are available.

#### Role Tools (manage roles and permissions) (0 tools)
No role tools are available.

#### Agent Tools (create/manage AI agents and their triggers) (0 tools)
No agent tools are available.

#### MCP Server Tools (external tools, grouped by server) (0 tools)
No MCP tools are available.

### How to Use Tools
1. **Pre-loaded tools** (marked with ✓): Use directly
2. **Other tools**: First call \`learn_tools({toolNames: ["tool_name"]})\` to learn the schema, then call \`execute_tool({toolName: "tool_name", arguments: {...}})\` to run it`);
  });
  it('renders skill descriptions and label fallback', () => {
    const skills = [
      { name: 'research', description: 'Research records', label: 'Research' },
      { name: 'organize', description: null, label: 'Organize records' },
    ] as FlatSkill[];
    expect(buildSkillCatalogSection(skills)).toBe(`
## Available Skills

Skills provide detailed expertise for specialized tasks. Load a skill before attempting complex operations.
To load a skill, call \`load_skills\` with the skill name(s).

- \`research\`: Research records
- \`organize\`: Organize records`);
  });
  it('renders the empty skill catalog', () => {
    expect(buildSkillCatalogSection([])).toBe(`
## Available Skills

Skills provide detailed expertise for specialized tasks. Load a skill before attempting complex operations.
To load a skill, call \`load_skills\` with the skill name(s).

No skills are available.`);
  });
  it('renders full user context', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T12:00:00Z'));
    try {
      expect(
        buildUserContextSection({
          firstName: 'Sam',
          lastName: 'Lee',
          jobTitle: 'Operator',
          locale: 'en-US',
          timezone: 'Asia/Kolkata',
        }),
      ).toBe(`
## User Context

User: Sam Lee
Job title: Operator
Locale: en-US
Timezone: Asia/Kolkata
Current date: Saturday, November 21, 2026`);
    } finally {
      jest.useRealTimers();
    }
  });
});
