import { type ApolloCache } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components/feedback';

import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import {
  AiToolAvailabilitiesDocument,
  SetAiToolAvailabilityDocument,
  SetAiToolAvailabilitiesDocument,
  type AiToolAvailabilitiesQuery,
  type SetAiToolAvailabilityInput,
} from '~/generated-metadata/graphql';

const mergeAvailabilities = (
  cache: ApolloCache,
  rows: AiToolAvailabilitiesQuery['aiToolAvailabilities'],
) => {
  for (const row of rows) {
    cache.updateQuery({ query: AiToolAvailabilitiesDocument }, (cached) => {
      const otherRows = (cached?.aiToolAvailabilities ?? []).filter(
        (availability) => availability.toolIdentifier !== row.toolIdentifier,
      );

      return {
        ...cached,
        aiToolAvailabilities:
          row.isAgentEnabled && row.isMcpEnabled
            ? otherRows
            : [...otherRows, row],
      };
    });
  }
};

export const useAiToolAvailabilities = () => {
  const { enqueueToast } = useToast();
  const {
    data,
    loading: isLoading,
    error,
  } = useQuery(AiToolAvailabilitiesDocument, {
    // cache-and-network would refetch (and rebuild the server catalog) for every table row that mounts
    fetchPolicy: 'cache-first',
  });
  const [setAvailabilityMutation] = useMutation(SetAiToolAvailabilityDocument);
  const [setAvailabilitiesMutation] = useMutation(
    SetAiToolAvailabilitiesDocument,
  );
  const { availabilityByToolIdentifier, availabilityByToolName } =
    useMemo(() => {
      const rows = error ? [] : (data?.aiToolAvailabilities ?? []);

      return {
        availabilityByToolIdentifier: new Map(
          rows.map((row) => [row.toolIdentifier, row]),
        ),
        availabilityByToolName: new Map(
          rows.flatMap((row) =>
            isDefined(row.toolName) ? [[row.toolName, row] as const] : [],
          ),
        ),
      };
    }, [data, error]);

  const setAvailability = async ({
    toolName,
    ...input
  }: SetAiToolAvailabilityInput & { toolName: string | null }) => {
    try {
      await setAvailabilityMutation({
        variables: { input },
        optimisticResponse: {
          setAiToolAvailability: {
            __typename: 'AiToolAvailability',
            toolName,
            ...input,
          },
        },
        update: (cache, { data: mutationData }) => {
          const row = mutationData?.setAiToolAvailability;

          if (!isDefined(row)) {
            return;
          }

          mergeAvailabilities(cache, [row]);
        },
      });
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
    }
  };

  const setAvailabilities = async (items: SetAiToolAvailabilityInput[]) => {
    try {
      const result = await setAvailabilitiesMutation({
        variables: { input: { items } },
        update: (cache, { data: mutationData }) => {
          if (isDefined(mutationData?.setAiToolAvailabilities)) {
            mergeAvailabilities(cache, mutationData.setAiToolAvailabilities);
          }
        },
      });

      return isDefined(result.data?.setAiToolAvailabilities);
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
      return false;
    }
  };

  return {
    availabilityByToolIdentifier,
    availabilityByToolName,
    isLoading,
    setAvailability,
    setAvailabilities,
  };
};
