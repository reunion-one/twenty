// The editor's markdown parser drops unknown tags such as <browsing_context>; a backslash keeps them as text.
export const escapeTagBracketsForEditor = (template: string): string =>
  template.replace(/<(?=[a-zA-Z_/])/g, '\\<');
