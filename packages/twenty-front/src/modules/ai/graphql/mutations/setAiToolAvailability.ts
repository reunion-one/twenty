import { gql } from '@apollo/client';

export const SET_AI_TOOL_AVAILABILITY = gql`
  mutation SetAiToolAvailability($input: SetAiToolAvailabilityInput!) {
    setAiToolAvailability(input: $input) {
      toolIdentifier
      toolName
      isAgentEnabled
      isMcpEnabled
    }
  }
`;
