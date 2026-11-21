import { ToolCategory } from 'twenty-shared/ai';
import { assertUnreachable } from 'twenty-shared/utils';
import {
  EXECUTE_TOOL_TOOL_NAME,
  LEARN_TOOLS_TOOL_NAME,
} from 'src/engine/core-modules/tool-provider/tools';

export const AI_SYSTEM_PROMPT_TOOL_CATEGORY_PATHS = {
  [ToolCategory.DATABASE_CRUD]: 'record',
  [ToolCategory.ACTION]: 'action',
  [ToolCategory.WORKFLOW]: 'workflow',
  [ToolCategory.METADATA]: 'metadata',
  [ToolCategory.VIEW]: 'view',
  [ToolCategory.FRONT_COMPONENT]: 'frontComponent',
  [ToolCategory.PAGE_LAYOUT]: 'pageLayout',
  [ToolCategory.NAVIGATION_MENU_ITEM]: 'navigationMenuItem',
  [ToolCategory.WEBHOOK]: 'webhook',
  [ToolCategory.LOGIC_FUNCTION]: 'logicFunction',
  [ToolCategory.ROLE]: 'role',
  [ToolCategory.AGENT]: 'agent',
  [ToolCategory.MCP]: 'mcp',
} as const satisfies Record<ToolCategory, string>;

export const getCategoryLabel = (category: ToolCategory): string => {
  switch (category) {
    case ToolCategory.DATABASE_CRUD:
      return 'Database Tools (CRUD operations)';
    case ToolCategory.ACTION:
      return 'Action Tools (HTTP, Email, etc.)';
    case ToolCategory.WORKFLOW:
      return 'Workflow Tools (create/manage workflows)';
    case ToolCategory.METADATA:
      return 'Metadata Tools (schema management)';
    case ToolCategory.VIEW:
      return 'View Tools (manage views, fields, filters, and sorts)';
    case ToolCategory.FRONT_COMPONENT:
      return 'Frontend Components (preview and save Workspace components)';
    case ToolCategory.PAGE_LAYOUT:
      return 'Page Layout Tools (manage dashboards, tabs and widgets, and place components on dashboard or record pages)';
    case ToolCategory.LOGIC_FUNCTION:
      return 'Logic Functions (custom tools)';
    case ToolCategory.NAVIGATION_MENU_ITEM:
      return 'Navigation Menu Item Tools (sidebar entries, folders, and user favorites)';
    case ToolCategory.WEBHOOK:
      return 'Webhook Tools (outgoing webhooks)';
    case ToolCategory.ROLE:
      return 'Role Tools (manage roles and permissions)';
    case ToolCategory.AGENT:
      return 'Agent Tools (create/manage AI agents and their triggers)';
    case ToolCategory.MCP:
      return 'MCP Server Tools (external tools, grouped by server)';
    default:
      return assertUnreachable(category);
  }
};

export const TOOL_CATEGORY_WORDS = {
  [ToolCategory.DATABASE_CRUD]: 'record',
  [ToolCategory.ACTION]: 'action',
  [ToolCategory.WORKFLOW]: 'workflow',
  [ToolCategory.METADATA]: 'metadata',
  [ToolCategory.VIEW]: 'view',
  [ToolCategory.FRONT_COMPONENT]: 'front component',
  [ToolCategory.PAGE_LAYOUT]: 'page layout',
  [ToolCategory.NAVIGATION_MENU_ITEM]: 'navigation menu item',
  [ToolCategory.WEBHOOK]: 'webhook',
  [ToolCategory.LOGIC_FUNCTION]: 'logic function',
  [ToolCategory.ROLE]: 'role',
  [ToolCategory.AGENT]: 'agent',
  [ToolCategory.MCP]: 'MCP',
} satisfies Record<ToolCategory, string>;

export const TOOL_CATALOG_TEMPLATE = `
## Available Tools

You have access to {{tools.count}} tools. Some are pre-loaded and ready to use immediately.
To use any other tool, first call \`${LEARN_TOOLS_TOOL_NAME}\` to learn its schema, then call \`${EXECUTE_TOOL_TOOL_NAME}\` to run it.

### Pre-loaded Tools (ready to use now {{tools.preloaded.count}})
{{tools.preloaded.list}}

### Tool Catalog by Category
${Object.values(ToolCategory)
  .map((category) => {
    const path = `tools.${AI_SYSTEM_PROMPT_TOOL_CATEGORY_PATHS[category]}`;
    const heading = `
#### ${getCategoryLabel(category)} ({{${path}.count}} tools)`;

    return category === ToolCategory.DATABASE_CRUD
      ? `${heading}
Operations per object:
{{tools.record.patterns.list}}

Objects ({{objects.count}}):
{{objects.list}}

Tool name = operation + object name. *_many_* operations use the plural form, *_one_* use the singular form.`
      : `${heading}
{{${path}.list}}`;
  })
  .join('\n')}

### How to Use Tools
1. **Pre-loaded tools** (marked with ✓): Use directly
2. **Other tools**: First call \`${LEARN_TOOLS_TOOL_NAME}({toolNames: ["tool_name"]})\` to learn the schema, then call \`${EXECUTE_TOOL_TOOL_NAME}({toolName: "tool_name", arguments: {...}})\` to run it`;
