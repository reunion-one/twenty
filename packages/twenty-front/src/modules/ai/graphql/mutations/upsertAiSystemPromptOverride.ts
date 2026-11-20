import { gql } from '@apollo/client';

export const UPSERT_AI_SYSTEM_PROMPT_OVERRIDE = gql`
  mutation UpsertAiSystemPromptOverride(
    $input: UpsertAiSystemPromptOverrideInput!
  ) {
    upsertAiSystemPromptOverride(input: $input)
  }
`;
