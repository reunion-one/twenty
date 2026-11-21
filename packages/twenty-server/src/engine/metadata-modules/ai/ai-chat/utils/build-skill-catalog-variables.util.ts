import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';

export const buildSkillCatalogVariables = (skillCatalog: FlatSkill[]) => {
  const skills = [
    ...new Map(skillCatalog.map((skill) => [skill.name, skill])).values(),
  ];
  return {
    skills: {
      list:
        skills.length === 0
          ? 'No skills are available.'
          : skills
              .map(
                (skill) =>
                  `- \`${skill.name}\`: ${skill.description ?? skill.label}`,
              )
              .join('\n'),
      count: skills.length,
    },
  };
};
