import { resolveStringTemplate } from 'twenty-shared/utils';
import { TOOL_CATALOG_TEMPLATE } from 'src/engine/core-modules/tool-provider/constants/tool-catalog-prompt-template.constant';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { buildToolCatalogVariables } from 'src/engine/core-modules/tool-provider/utils/build-tool-catalog-variables.util';

export const buildToolCatalogSection = (
  toolCatalog: ToolIndexEntry[],
  preloadedTools: string[],
): string =>
  resolveStringTemplate(
    TOOL_CATALOG_TEMPLATE,
    buildToolCatalogVariables(toolCatalog, preloadedTools),
  );
