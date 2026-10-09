import { AttachmentUploader } from '@/activities/files/components/AttachmentUploader';
import { useCanUploadAttachmentFiles } from '@/activities/files/hooks/useCanUploadAttachmentFiles';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';

export const WidgetActionFileAttach = () => {
  const targetRecord = useTargetRecord();
  const { canUploadFiles } = useCanUploadAttachmentFiles(targetRecord);

  if (!canUploadFiles) {
    return null;
  }

  return (
    <AttachmentUploader
      targetableObject={targetRecord}
      canUploadFiles={canUploadFiles}
      appearance="header"
    />
  );
};
