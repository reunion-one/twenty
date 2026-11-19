import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useCanUploadAttachmentFiles } from '@/activities/files/hooks/useCanUploadAttachmentFiles';
import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { MAX_ATTACHMENT_SIZE } from '@/advanced-text-editor/utils/maxAttachmentSize';
import { formatFileSize } from '@/file/utils/formatFileSize';
import { useLingui } from '@lingui/react/macro';

export const useUploadAttachmentFilesWithDocumentType = ({
  targetableObject,
}: {
  targetableObject: ActivityTargetableObject;
}) => {
  const { t } = useLingui();
  const attachmentDocumentType = useAttachmentDocumentType();
  const { canUploadFiles } = useCanUploadAttachmentFiles(targetableObject);
  const { uploadAttachmentFile } = useUploadAttachmentFile();

  const uploadFiles = async (files: File[], docType?: string | null) => {
    if (files.some((file) => file.size > MAX_ATTACHMENT_SIZE)) {
      const maximumFileSize = formatFileSize(MAX_ATTACHMENT_SIZE);

      throw new Error(t`Files must be smaller than ${maximumFileSize}.`);
    }

    if (!canUploadFiles) {
      throw new Error(t`You do not have permission to upload files here.`);
    }

    if (docType !== undefined) {
      if (
        !attachmentDocumentType.isSelectField ||
        !attachmentDocumentType.canReadField ||
        !attachmentDocumentType.canUpdateField
      ) {
        const fieldLabel = attachmentDocumentType.label ?? t`This field`;

        throw new Error(t`${fieldLabel} is no longer available for this file.`);
      }

      if (docType === null && !attachmentDocumentType.isNullable) {
        const fieldLabel = attachmentDocumentType.label ?? t`this field`;

        throw new Error(t`A value is required for ${fieldLabel}.`);
      }

      if (
        docType !== null &&
        !attachmentDocumentType.selectableOptions.some(
          (option) => option.value === docType,
        )
      ) {
        const fieldLabel = attachmentDocumentType.label ?? t`type`;

        throw new Error(t`The selected ${fieldLabel} is no longer available.`);
      }
    } else if (
      attachmentDocumentType.isSelectField &&
      !attachmentDocumentType.isNullable
    ) {
      const fieldLabel = attachmentDocumentType.label ?? t`this field`;

      throw new Error(t`A value is required for ${fieldLabel}.`);
    }

    for (const file of files) {
      await uploadAttachmentFile(file, targetableObject, docType);
    }
  };

  return { uploadFiles };
};
