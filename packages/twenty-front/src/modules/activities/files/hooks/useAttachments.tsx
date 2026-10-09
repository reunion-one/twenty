import { type Attachment } from '@/activities/files/types/Attachment';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { getActivityTargetObjectFieldIdName } from '@/activities/utils/getActivityTargetObjectFieldIdName';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useListenToEventsForQuery } from '@/sse-db-event/hooks/useListenToEventsForQuery';
import { useMemo } from 'react';

export const useAttachments = (targetableObject: ActivityTargetableObject) => {
  const targetableObjectFieldIdName = getActivityTargetObjectFieldIdName({
    nameSingular: targetableObject.targetObjectNameSingular,
  });
  const filter = useMemo(
    () => ({
      [targetableObjectFieldIdName]: {
        eq: targetableObject.id,
      },
    }),
    [targetableObject.id, targetableObjectFieldIdName],
  );
  const operationSignature = useMemo(
    () => ({
      objectNameSingular: CoreObjectNameSingular.Attachment,
      variables: { filter },
      fields: {
        id: true,
        name: true,
        file: true,
        createdAt: true,
        docType: true,
      },
    }),
    [filter],
  );

  const {
    records: attachments,
    loading,
    totalCount,
    refetch,
  } = useFindManyRecords<Attachment>({
    objectNameSingular: CoreObjectNameSingular.Attachment,
    filter,
    recordGqlFields: operationSignature.fields,
    orderBy: [
      {
        createdAt: 'DescNullsFirst',
      },
    ],
  });

  useListenToEventsForQuery({
    queryId: `attachments-${targetableObject.targetObjectNameSingular}-${targetableObject.id}`,
    operationSignature,
    onSseReconnected: async () => {
      await refetch();
    },
  });

  return {
    attachments,
    loading,
    totalCountAttachments: totalCount,
  };
};
