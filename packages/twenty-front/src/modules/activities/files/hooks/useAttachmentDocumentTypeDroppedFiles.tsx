import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useUploadAttachmentFiles } from '@/activities/files/hooks/useUploadAttachmentFiles';
import { useUploadAttachmentFilesWithDocumentType } from '@/activities/files/hooks/useUploadAttachmentFilesWithDocumentType';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { SelectInput } from '@/ui/input/components/SelectInput';
import { DialogInstance } from '@/ui/layout/dialog/components/DialogInstance';
import { useDialog } from '@/ui/layout/dialog/hooks/useDialog';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { type ReactNode, useId, useState } from 'react';
import { useToast } from 'twenty-ui/components/feedback';
import { Dropdown } from 'twenty-ui/components/navigation';
import { Button } from 'twenty-ui/primitives/input';
import { Dialog } from 'twenty-ui/primitives/surfaces';

export const useAttachmentDocumentTypeDroppedFiles = (
  targetableObject: ActivityTargetableObject,
) => {
  const { t } = useLingui();
  const documentType = useAttachmentDocumentType();
  const { uploadFiles } = useUploadAttachmentFilesWithDocumentType({
    targetableObject,
  });
  const { uploadAttachmentFiles } = useUploadAttachmentFiles();
  const { enqueueToast } = useToast();
  const { openDialog, closeDialog } = useDialog();
  const { closeDropdown } = useCloseDropdown();
  const instanceId = useId();
  const dialogId = `attachment-document-type-drop-${instanceId}`;
  const dropdownId = `${dialogId}-select`;
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const canUseTypeOptions =
    documentType.isReadableSelectField && documentType.canUpdateField;
  const fieldLabel = documentType.label ?? t`this field`;
  const fileCount = pendingFiles.length;
  const title = plural(fileCount, {
    one: `Choose ${fieldLabel} for # file`,
    other: `Choose ${fieldLabel} for # files`,
  });

  const uploadBatch = async (files: File[], docType?: string | null) => {
    if (!documentType.isSelectField) {
      try {
        await uploadAttachmentFiles({ files, targetableObject });
      } finally {
        setIsBusy(false);
      }
      return;
    }
    try {
      await uploadFiles(files, docType);
      if (
        documentType.isNullable &&
        (docType === null || docType === undefined)
      ) {
        const unclassifiedFieldLabel = documentType.label ?? t`a type`;
        enqueueToast({
          status: 'info',
          children: t`Files were uploaded without ${unclassifiedFieldLabel}.`,
        });
      }
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
    } finally {
      setIsBusy(false);
    }
  };

  const uploadDroppedFiles = async (files: File[]) => {
    if (isBusy || files.length === 0) {
      return;
    }
    if (
      documentType.isSelectField &&
      !documentType.isNullable &&
      (!canUseTypeOptions || documentType.selectableOptions.length === 0)
    ) {
      const reason = !canUseTypeOptions
        ? t`You need permission to set ${fieldLabel} before uploading files.`
        : t`Add an option to ${fieldLabel} before uploading files.`;
      enqueueToast({ status: 'error', children: reason });
      return;
    }
    setIsBusy(true);
    if (documentType.isSelectField && !documentType.isNullable) {
      setPendingFiles(files);
      openDialog(dialogId);
      return;
    }
    await uploadBatch(
      files,
      documentType.isSelectField && canUseTypeOptions ? null : undefined,
    );
  };

  const cancel = () => {
    setPendingFiles([]);
    setIsBusy(false);
    closeDropdown(dropdownId);
    closeDialog(dialogId);
  };

  const documentTypeDialog: ReactNode = (
    <DialogInstance dialogId={dialogId} dismissible onClose={cancel}>
      {({ onKeyDown }) => (
        <Dialog.Popup aria-label={title} onKeyDown={onKeyDown} size="sm">
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <DropdownRoot dropdownId={dropdownId} type="menu">
              <Dropdown.Trigger
                render={
                  <Button variant="outline">{t`Choose ${fieldLabel}`}</Button>
                }
              />
              <DropdownContent
                align="start"
                width={GenericDropdownContentWidth.Narrow}
              >
                <SelectInput
                  options={documentType.selectableOptions}
                  onOptionSelected={(option) => {
                    const files = pendingFiles;
                    setPendingFiles([]);
                    closeDropdown(dropdownId);
                    closeDialog(dialogId);
                    void uploadBatch(files, option.value);
                  }}
                />
              </DropdownContent>
            </DropdownRoot>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" onClick={cancel}>{t`Cancel`}</Button>
          </Dialog.Footer>
        </Dialog.Popup>
      )}
    </DialogInstance>
  );

  return { uploadDroppedFiles, documentTypeDialog };
};
