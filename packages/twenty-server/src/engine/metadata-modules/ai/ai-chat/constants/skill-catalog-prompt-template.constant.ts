import { LOAD_SKILL_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools';

export const SKILL_CATALOG_TEMPLATE = `
## Available Skills

Skills provide detailed expertise for specialized tasks. Load a skill before attempting complex operations.
To load a skill, call \`${LOAD_SKILL_TOOL_NAME}\` with the skill name(s).

{{skills.list}}`;
