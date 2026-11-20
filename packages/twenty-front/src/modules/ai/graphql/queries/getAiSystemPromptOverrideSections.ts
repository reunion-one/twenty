import { gql } from '@apollo/client';

export const GET_AI_SYSTEM_PROMPT_OVERRIDE_SECTIONS = gql`
  query GetAiSystemPromptOverrideSections {
    aiSystemPromptOverrideSections {
      sectionKey
      title
      defaultTemplate
      overrideContent
      isDefaultChanged
    }
  }
`;
