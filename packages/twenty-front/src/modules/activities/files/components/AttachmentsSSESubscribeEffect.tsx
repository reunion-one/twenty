import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { getActivityTargetObjectFieldIdName } from '@/activities/utils/getActivityTargetObjectFieldIdName';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useRefetchFindManyRecords } from '@/object-record/hooks/useRefetchFindManyRecords';
import { useListenToEventsForQuery } from '@/sse-db-event/hooks/useListenToEventsForQuery';
import { useMemo } from 'react';
import { StandardObjectNameSingular } from 'twenty-shared/types';

type AttachmentsSSESubscribeEffectProps = {
  targetRecord: ActivityTargetableObject;
};

export const AttachmentsSSESubscribeEffect = ({
  targetRecord,
}: AttachmentsSSESubscribeEffectProps) => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: StandardObjectNameSingular.Attachment,
  });
  const { refetchFindManyRecords } = useRefetchFindManyRecords({
    objectMetadataNamePlural: objectMetadataItem.namePlural,
  });
  const filter = useMemo(
    () => ({
      [getActivityTargetObjectFieldIdName({
        nameSingular: targetRecord.targetObjectNameSingular,
      })]: { eq: targetRecord.id },
    }),
    [targetRecord.targetObjectNameSingular, targetRecord.id],
  );

  useListenToEventsForQuery({
    queryId: `attachments-${targetRecord.targetObjectNameSingular}-${targetRecord.id}`,
    operationSignature: {
      objectNameSingular: StandardObjectNameSingular.Attachment,
      variables: { filter },
    },
    onSseReconnected: refetchFindManyRecords,
  });

  return null;
};
