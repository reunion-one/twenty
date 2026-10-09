import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';

export const useUploadAttachmentFiles = () => {
  const { uploadAttachmentFile } = useUploadAttachmentFile();

  const uploadAttachmentFiles = async ({
    files,
    targetableObject,
    docType,
  }: {
    files: File[];
    targetableObject: ActivityTargetableObject;
    docType?: string | null;
  }) => {
    for (const file of files) {
      await uploadAttachmentFile(file, targetableObject, docType);
    }
  };

  return { uploadAttachmentFiles };
};
