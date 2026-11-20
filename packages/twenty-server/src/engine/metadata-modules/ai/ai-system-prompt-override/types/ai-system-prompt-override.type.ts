import { AI_SYSTEM_PROMPT_OVERRIDE_KEY_PREFIX } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-override-key-prefix.constant';
import { type AiSystemPromptSectionKey } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-editable-sections.constant';

export type AiSystemPromptOverride = { content: string; defaultHash: string };
export type AiSystemPromptOverrideValueMap = Record<
  `${typeof AI_SYSTEM_PROMPT_OVERRIDE_KEY_PREFIX}${AiSystemPromptSectionKey}`,
  AiSystemPromptOverride
>;
