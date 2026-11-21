import { gql } from '@apollo/client';

export const SET_AI_TOOL_AVAILABILITIES = gql`
  mutation SetAiToolAvailabilities($input: SetAiToolAvailabilitiesInput!) {
    setAiToolAvailabilities(input: $input) {
      toolIdentifier
      toolName
      isAgentEnabled
      isMcpEnabled
    }
  }
`;
