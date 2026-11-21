import { resolveStringTemplate } from 'twenty-shared/utils';
import { SKILL_CATALOG_TEMPLATE } from 'src/engine/metadata-modules/ai/ai-chat/constants/skill-catalog-prompt-template.constant';
import { buildSkillCatalogVariables } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-skill-catalog-variables.util';
import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';

export const buildSkillCatalogSection = (skillCatalog: FlatSkill[]): string =>
  resolveStringTemplate(
    SKILL_CATALOG_TEMPLATE,
    buildSkillCatalogVariables(skillCatalog),
  );
