import { useMutation, useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components/feedback';

import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import {
  AiToolAvailabilitiesDocument,
  SetAiToolAvailabilityDocument,
  type SetAiToolAvailabilityInput,
} from '~/generated-metadata/graphql';

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

          cache.updateQuery(
            { query: AiToolAvailabilitiesDocument },
            (cached) => {
              const otherRows = (cached?.aiToolAvailabilities ?? []).filter(
                (availability) =>
                  availability.toolIdentifier !== row.toolIdentifier,
              );

              return {
                ...cached,
                aiToolAvailabilities:
                  row.isAgentEnabled && row.isMcpEnabled
                    ? otherRows
                    : [...otherRows, row],
              };
            },
          );
        },
      });
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
    }
  };

  return {
    availabilityByToolIdentifier,
    availabilityByToolName,
    isLoading,
    setAvailability,
  };
};
