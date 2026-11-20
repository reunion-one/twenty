export const unescapeMarkdownText = (text: string): string =>
  text
    .replace(/^(\s{0,3}\d+)\\([.)])(?=\s|$)/gm, '$1$2')
    .replace(/^(\s{0,3})\\\+(?=\s|$)/gm, '$1+')
    .replace(/^(\s{0,3})\\-(?=-{2}|\s|$)/gm, '$1-')
    .replace(/^(\s{0,3})\\>(?=\s|$)/gm, '$1>')
    .replace(/\\([\\`*_[\]{}<>~|#&])/g, '$1');
