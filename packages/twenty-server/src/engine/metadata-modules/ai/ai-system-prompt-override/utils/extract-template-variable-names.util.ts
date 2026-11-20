export const extractTemplateVariableNames = (template: string): string[] =>
  Array.from(template.matchAll(/\{\{([^{}]+)\}\}/g), (match) => match[1]);
