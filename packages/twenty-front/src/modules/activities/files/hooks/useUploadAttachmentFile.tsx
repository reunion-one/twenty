import { type Attachment } from '@/activities/files/types/Attachment';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { getActivityTargetObjectFieldIdName } from '@/activities/utils/getActivityTargetObjectFieldIdName';
import { useDirectFileUpload } from '@/file/hooks/useDirectFileUpload';
import { MAX_ATTACHMENT_SIZE } from '@/advanced-text-editor/utils/maxAttachmentSize';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { canUploadAttachmentFiles } from '@/activities/files/hooks/useCanUploadAttachmentFiles';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { getObjectPermissionsForObject } from '@/object-metadata/utils/getObjectPermissionsForObject';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { t } from '@lingui/core/macro';
import { assertIsDefinedOrThrow, isDefined } from 'twenty-shared/utils';
import {
  FieldMetadataType,
  FileFolder,
  PermissionFlagType,
} from '~/generated-metadata/graphql';

export const useUploadAttachmentFile = () => {
  const { uploadFile: directUploadFile } = useDirectFileUpload();
  const attachmentDocumentType = useAttachmentDocumentType();
  const { objectMetadataItem: attachmentMetadata } = useObjectMetadataItem({
    objectNameSingular: CoreObjectNameSingular.Attachment,
  });
  const { objectMetadataItems } = useObjectMetadataItems();
  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();
  const hasUploadPermission = useHasPermissionFlag(
    PermissionFlagType.UPLOAD_FILE,
  );

  const filesFieldMetadataId = attachmentMetadata.fields.find(
    (field) => field.type === FieldMetadataType.FILES && field.name === 'file',
  )?.id;

  const { createOneRecord: createOneAttachment } =
    useCreateOneRecord<Attachment>({
      objectNameSingular: CoreObjectNameSingular.Attachment,
      shouldMatchRootQueryFilter: true,
    });

  const uploadAttachmentFile = async (
    file: File,
    targetableObject: ActivityTargetableObject,
    docType?: string | null,
  ) => {
    const fieldLabel = attachmentDocumentType.label;

    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(
        t({
          id: 'Files must be smaller than 10 MB.',
          message: 'Files must be smaller than 10 MB.',
        }),
      );
    }

    const targetObjectMetadataItem = objectMetadataItems.find(
      (metadataItem) =>
        metadataItem.nameSingular === targetableObject.targetObjectNameSingular,
    );
    const canUploadFiles =
      isDefined(targetObjectMetadataItem) &&
      canUploadAttachmentFiles({
        targetObjectMetadataItem,
        canUpdateObjectRecords: getObjectPermissionsForObject(
          objectPermissionsByObjectMetadataId,
          targetObjectMetadataItem.id,
        ).canUpdateObjectRecords,
        hasUploadPermission,
      });

    if (!canUploadFiles) {
      throw new Error(
        t({
          id: 'You do not have permission to upload files here.',
          message: 'You do not have permission to upload files here.',
        }),
      );
    }

    if (docType !== undefined) {
      const { hasFieldMetadata, canReadField, canUpdateField, isNullable } =
        attachmentDocumentType;

      if (!hasFieldMetadata || !canReadField || !canUpdateField) {
        throw new Error(
          t({
            id: '{fieldLabel} is no longer available for this file.',
            message: `${{ fieldLabel: fieldLabel ?? 'This field' }} is no longer available for this file.`,
          }),
        );
      }

      if (docType === null && !isNullable) {
        throw new Error(
          t({
            id: 'A value is required for {fieldLabel}.',
            message: `A value is required for ${{ fieldLabel: fieldLabel ?? 'this field' }}.`,
          }),
        );
      }

      if (
        docType !== null &&
        !attachmentDocumentType.options.some(
          (option) => option.value === docType,
        )
      ) {
        throw new Error(
          t({
            id: 'The selected {fieldLabel} is no longer available.',
            message: `The selected ${{ fieldLabel: fieldLabel ?? 'type' }} is no longer available.`,
          }),
        );
      }
    } else if (
      attachmentDocumentType.isSelectField &&
      !attachmentDocumentType.isNullable
    ) {
      throw new Error(
        t({
          id: 'A value is required for {fieldLabel}.',
          message: `A value is required for ${{ fieldLabel: fieldLabel ?? 'this field' }}.`,
        }),
      );
    }

    assertIsDefinedOrThrow(
      filesFieldMetadataId,
      new Error(t`File field not found for attachment object`),
    );

    const uploadedFile = await directUploadFile(file, {
      fileFolder: FileFolder.FilesField,
      fieldMetadataId: filesFieldMetadataId,
    });

    if (!isDefined(uploadedFile)) {
      throw new Error("Couldn't upload the attachment.");
    }

    const targetableObjectFieldIdName = getActivityTargetObjectFieldIdName({
      nameSingular: targetableObject.targetObjectNameSingular,
    });

    const attachmentToCreate = {
      name: file.name,
      [targetableObjectFieldIdName]: targetableObject.id,
      file: [
        {
          fileId: uploadedFile.id,
          label: file.name,
        },
      ],
      ...(docType !== undefined && { docType }),
    } as Partial<Attachment>;

    await createOneAttachment(attachmentToCreate);

    return {
      attachmentAbsoluteURL: uploadedFile.url,
      attachmentFileId: uploadedFile.id,
    };
  };

  return { uploadAttachmentFile };
};
