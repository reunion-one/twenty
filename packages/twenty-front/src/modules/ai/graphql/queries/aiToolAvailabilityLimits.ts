import { gql } from '@apollo/client';

export const AI_TOOL_AVAILABILITY_LIMITS = gql`
  query AiToolAvailabilityLimits {
    aiToolAvailabilityLimits {
      neverAvailableToAgents
      neverAvailableOverMcp
    }
  }
`;
