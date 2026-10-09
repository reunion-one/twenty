import { FilesCardContent } from '@/activities/files/components/FilesCardContent';
import { useAttachments } from '@/activities/files/hooks/useAttachments';
import { useCanUploadAttachmentFiles } from '@/activities/files/hooks/useCanUploadAttachmentFiles';
import { WidgetHeaderCountEffect } from '@/page-layout/widgets/components/WidgetHeaderCountEffect';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';

export const FilesCard = () => {
  const targetRecord = useTargetRecord();
  const { attachments, loading, totalCountAttachments } =
    useAttachments(targetRecord);
  const { canUploadFiles } = useCanUploadAttachmentFiles(targetRecord);

  return (
    <>
      <WidgetHeaderCountEffect count={totalCountAttachments} />
      <FilesCardContent
        attachments={attachments}
        canUploadFiles={canUploadFiles}
        loading={loading}
        targetRecord={targetRecord}
      />
    </>
  );
};
