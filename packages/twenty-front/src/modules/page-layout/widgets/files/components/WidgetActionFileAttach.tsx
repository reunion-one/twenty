import { AttachmentDocumentTypeWidgetAction } from '@/page-layout/widgets/files/components/AttachmentDocumentTypeWidgetAction';
import { useAttachFileRelatedRecordAction } from '@/activities/files/hooks/useAttachFileRelatedRecordAction';
import { WidgetActionRelatedRecord } from '@/page-layout/widgets/components/WidgetActionRelatedRecord';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';

export const WidgetActionFileAttach = () => {
  const targetRecord = useTargetRecord();
  const binding = useAttachFileRelatedRecordAction({ targetRecord });

  return (
    <AttachmentDocumentTypeWidgetAction
      targetRecord={targetRecord}
      fallback={<WidgetActionRelatedRecord binding={binding} />}
    />
  );
};
