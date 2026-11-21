import { gql } from '@apollo/client';

export const DELETE_AI_SYSTEM_PROMPT_OVERRIDE = gql`
  mutation DeleteAiSystemPromptOverride($sectionKey: String!) {
    deleteAiSystemPromptOverride(sectionKey: $sectionKey)
  }
`;
