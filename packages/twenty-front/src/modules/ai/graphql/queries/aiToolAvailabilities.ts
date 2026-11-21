import { gql } from '@apollo/client';

export const AI_TOOL_AVAILABILITIES = gql`
  query AiToolAvailabilities {
    aiToolAvailabilities {
      toolIdentifier
      toolName
      isAgentEnabled
      isMcpEnabled
    }
  }
`;
