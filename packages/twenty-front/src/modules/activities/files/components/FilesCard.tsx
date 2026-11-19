import { AttachmentsSSESubscribeEffect } from '@/activities/files/components/AttachmentsSSESubscribeEffect';
import { FilesCardContent } from '@/activities/files/components/FilesCardContent';
import { useAttachments } from '@/activities/files/hooks/useAttachments';
import { useCanUploadAttachmentFiles } from '@/activities/files/hooks/useCanUploadAttachmentFiles';
import { useAttachmentDocumentTypeDroppedFiles } from '@/activities/files/hooks/useAttachmentDocumentTypeDroppedFiles';
import { WidgetHeaderCountEffect } from '@/page-layout/widgets/components/WidgetHeaderCountEffect';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';

export const FilesCard = () => {
  const targetRecord = useTargetRecord();
  const { attachments, loading, totalCountAttachments } =
    useAttachments(targetRecord);
  const { uploadDroppedFiles, documentTypeDialog } =
    useAttachmentDocumentTypeDroppedFiles(targetRecord);
  const { canUploadFiles } = useCanUploadAttachmentFiles(targetRecord);

  const handleUploadFiles = (files: File[]) => uploadDroppedFiles(files);

  return (
    <>
      <WidgetHeaderCountEffect count={totalCountAttachments} />
      <AttachmentsSSESubscribeEffect targetRecord={targetRecord} />
      <FilesCardContent
        attachments={attachments}
        canUploadFiles={canUploadFiles}
        loading={loading}
        onUploadFiles={handleUploadFiles}
        targetRecord={targetRecord}
      />
      {documentTypeDialog}
    </>
  );
};
