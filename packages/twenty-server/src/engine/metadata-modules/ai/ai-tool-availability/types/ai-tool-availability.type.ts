import { AI_TOOL_AVAILABILITY_KEY_PREFIX } from 'src/engine/metadata-modules/ai/ai-tool-availability/constants/ai-tool-availability-key-prefix.constant';

export type AiToolAvailability = {
  isAgentEnabled: boolean;
  isMcpEnabled: boolean;
};
export type AiToolAvailabilityValueMap = Record<
  `${typeof AI_TOOL_AVAILABILITY_KEY_PREFIX}${string}`,
  AiToolAvailability
>;
