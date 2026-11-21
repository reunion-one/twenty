export const AI_SYSTEM_PROMPT_EDITABLE_SECTIONS = {
  assistantIdentity: 'Assistant Identity',
  baseInstructions: 'Base Instructions',
  browsingContext: 'Browsing Context',
  conversationAttachment: 'Conversation Attachment',
  responseFormat: 'Response Format',
  toolCatalog: 'Tool Catalog',
  componentBuilder: 'Component Builder',
  skillCatalog: 'Skill Catalog',
  participants: 'Participants',
  userContext: 'User Context',
} as const;

export type AiSystemPromptSectionKey =
  keyof typeof AI_SYSTEM_PROMPT_EDITABLE_SECTIONS;
