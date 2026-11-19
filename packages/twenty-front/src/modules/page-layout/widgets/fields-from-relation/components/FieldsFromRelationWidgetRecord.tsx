import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useUpsertRecordsInStore } from '@/object-record/record-store/hooks/useUpsertRecordsInStore';
import { WidgetSkeletonLoader } from '@/page-layout/widgets/components/WidgetSkeletonLoader';
import { PageLayoutWidgetErrorDisplay } from '@/page-layout/widgets/components/PageLayoutWidgetErrorDisplay';
import {
  LayoutRenderingProvider,
  useLayoutRenderingContext,
} from '@/ui/layout/contexts/LayoutRenderingContext';
import { useEffect, useState, type ReactNode } from 'react';
import { isDefined } from 'twenty-shared/utils';

type FieldsFromRelationWidgetRecordProps = {
  widgetId: string;
  objectNameSingular: string;
  recordId: string;
  children: ReactNode;
};

export const FieldsFromRelationWidgetRecord = ({
  widgetId,
  objectNameSingular,
  recordId,
  children,
}: FieldsFromRelationWidgetRecordProps) => {
  const context = useLayoutRenderingContext();
  const { record, loading, error } = useFindOneRecord({
    objectNameSingular,
    objectRecordId: recordId,
  });
  const { upsertRecordsInStore } = useUpsertRecordsInStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (isDefined(record)) {
      upsertRecordsInStore({ partialRecords: [record] });
      setReady(true);
    }
  }, [record, upsertRecordsInStore]);

  if (error) {
    return <PageLayoutWidgetErrorDisplay widgetId={widgetId} error={error} />;
  }
  if (loading || (isDefined(record) && !ready)) {
    return <WidgetSkeletonLoader />;
  }
  if (!isDefined(record)) {
    return null;
  }

  return (
    <LayoutRenderingProvider
      value={{
        ...context,
        targetRecordIdentifier: {
          id: recordId,
          targetObjectNameSingular: objectNameSingular,
        },
      }}
    >
      {children}
    </LayoutRenderingProvider>
  );
};
