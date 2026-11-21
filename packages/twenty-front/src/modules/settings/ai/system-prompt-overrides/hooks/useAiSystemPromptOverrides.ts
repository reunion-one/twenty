import { useMutation, useQuery } from '@apollo/client/react';
import { useToast } from 'twenty-ui/components/feedback';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import {
  GetAiSystemPromptPreviewDocument,
  GetAiSystemPromptOverrideSectionsDocument,
  UpsertAiSystemPromptOverrideDocument,
  DeleteAiSystemPromptOverrideDocument,
} from '~/generated-metadata/graphql';

export const useAiSystemPromptOverrides = () => {
  const { enqueueToast } = useToast();
  const { data } = useQuery(GetAiSystemPromptOverrideSectionsDocument);
  const refetchQueries = [
    GetAiSystemPromptPreviewDocument,
    GetAiSystemPromptOverrideSectionsDocument,
  ];
  const [upsertMutation, { loading: isUpserting }] = useMutation(
    UpsertAiSystemPromptOverrideDocument,
    { refetchQueries, awaitRefetchQueries: true },
  );
  const [deleteMutation, { loading: isDeleting }] = useMutation(
    DeleteAiSystemPromptOverrideDocument,
    { refetchQueries, awaitRefetchQueries: true },
  );

  const upsert = async (sectionKey: string, content: string) => {
    try {
      await upsertMutation({ variables: { input: { sectionKey, content } } });
      return true;
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
      return false;
    }
  };
  const deleteOverride = async (sectionKey: string) => {
    try {
      await deleteMutation({ variables: { sectionKey } });
      return true;
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
      return false;
    }
  };

  return {
    sections: data?.aiSystemPromptOverrideSections ?? [],
    upsert,
    deleteOverride,
    isSaving: isUpserting || isDeleting,
  };
};
