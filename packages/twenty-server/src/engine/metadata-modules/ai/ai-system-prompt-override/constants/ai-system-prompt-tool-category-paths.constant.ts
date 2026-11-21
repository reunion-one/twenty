import { ToolCategory } from 'twenty-shared/ai';

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
