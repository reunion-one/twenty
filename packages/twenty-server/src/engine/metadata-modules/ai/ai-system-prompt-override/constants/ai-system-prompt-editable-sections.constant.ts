export const AI_SYSTEM_PROMPT_EDITABLE_SECTIONS = {
  assistantIdentity: 'Assistant Identity',
  baseInstructions: 'Base Instructions',
  conversationAttachment: 'Conversation Attachment',
  responseFormat: 'Response Format',
  toolCatalog: 'Tool Catalog',
  skillCatalog: 'Skill Catalog',
  participants: 'Participants',
  userContext: 'User Context',
} as const;

export type AiSystemPromptSectionKey =
  keyof typeof AI_SYSTEM_PROMPT_EDITABLE_SECTIONS;

export const AI_SYSTEM_PROMPT_BLOCK_DEFAULTS = {
  toolCatalog: '{{toolCatalog}}',
  skillCatalog: '{{skillCatalog}}',
  userContext: '{{userContext}}',
} as const;
