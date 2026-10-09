import { AttachmentFileInput } from '@/activities/files/components/AttachmentFileInput';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useUploadAttachmentFiles } from '@/activities/files/hooks/useUploadAttachmentFiles';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { Dropdown } from 'twenty-ui/components/navigation';
import { WidgetCardHeaderActionButton } from '@/page-layout/widgets/widget-card/components/WidgetCardHeaderActionButton';
import { useDialog } from '@/ui/layout/dialog/hooks/useDialog';
import { DialogInstance } from '@/ui/layout/dialog/components/DialogInstance';
import { Button, type SelectOption } from 'twenty-ui/primitives/input';
import { Dialog } from 'twenty-ui/primitives/surfaces';
import { useToast } from 'twenty-ui/components/feedback';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { flushSync } from 'react-dom';
import { useId, useRef, useState, type ReactNode } from 'react';
import { IconPaperclip, IconPlus } from 'twenty-ui/icon';
import { SelectInput } from '@/ui/input/components/SelectInput';

const StyledScreenReaderText = styled.span`
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

type AttachmentUploaderRenderProps = {
  isUploading: boolean;
  canAcceptDroppedFiles: boolean;
  onUploadFiles: (files: File[]) => Promise<void>;
  trigger: ReactNode;
};

type AttachmentUploaderProps = {
  targetableObject: ActivityTargetableObject;
  appearance: 'empty-state' | 'header';
  canUploadFiles: boolean;
  onUploadComplete?: () => void;
  children?: (props: AttachmentUploaderRenderProps) => ReactNode;
};

export const AttachmentUploader = ({
  targetableObject,
  appearance,
  canUploadFiles,
  onUploadComplete,
  children,
}: AttachmentUploaderProps) => {
  const { t } = useLingui();
  const { enqueueToast } = useToast();
  const { uploadAttachmentFiles } = useUploadAttachmentFiles();
  const documentType = useAttachmentDocumentType();
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<
    string | null | undefined
  >(undefined);
  const [isNativePickerOpen, setIsNativePickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { openDialog, closeDialog } = useDialog();
  const { closeDropdown } = useCloseDropdown();
  const instanceId = useId().replaceAll(':', '');
  const dropdownId = `attachment-uploader-${targetableObject.id}-${instanceId}`;
  const dialogId = `attachment-document-type-${targetableObject.id}-${instanceId}`;
  const canUseTypeOptions =
    documentType.isReadableSelectField && documentType.canUpdateField;
  const canSetRequiredType =
    !documentType.isSelectField ||
    documentType.isNullable ||
    (canUseTypeOptions && documentType.options.length > 0);
  const isTriggerDisabled =
    !canUploadFiles ||
    !canSetRequiredType ||
    isUploading ||
    pendingFiles.length > 0;
  const canAcceptDroppedFiles =
    canUploadFiles &&
    canSetRequiredType &&
    !isUploading &&
    pendingFiles.length === 0;
  const fieldLabel = documentType.label ?? 'this field';
  const disabledReason = documentType.isSelectField
    ? !documentType.canReadField || !documentType.canUpdateField
      ? documentType.isNullable
        ? t({
            id: 'Files will be uploaded without {fieldLabel} because you cannot set it.',
            message: `Files will be uploaded without ${{ fieldLabel }} because you cannot set it.`,
          })
        : t({
            id: 'You need permission to set {fieldLabel} before uploading files.',
            message: `You need permission to set ${{ fieldLabel }} before uploading files.`,
          })
      : !documentType.isNullable && documentType.options.length === 0
        ? t({
            id: 'Add an option to {fieldLabel} before uploading files.',
            message: `Add an option to ${{ fieldLabel }} before uploading files.`,
          })
        : undefined
    : undefined;
  const descriptionId = `attachment-uploader-description-${instanceId}`;

  const showUnclassifiedUploadToast = () => {
    enqueueToast({
      variant: 'info',
      children: t({
        id: 'Files were uploaded without {fieldLabel}.',
        message: `Files were uploaded without ${{ fieldLabel: documentType.label ?? 'a type' }}.`,
      }),
    });
  };

  const uploadFiles = async (
    files: File[],
    docType?: string | null,
  ): Promise<void> => {
    if (files.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);

    try {
      await uploadAttachmentFiles({ files, targetableObject, docType });
      if (
        documentType.isSelectField &&
        documentType.isNullable &&
        (docType === null || docType === undefined)
      ) {
        showUnclassifiedUploadToast();
      }
      onUploadComplete?.();
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFilesDropped = async (files: File[]) => {
    if (!canAcceptDroppedFiles || files.length === 0) {
      return;
    }

    if (documentType.isSelectField && !documentType.isNullable) {
      setPendingFiles(files);
      openDialog(dialogId);
      return;
    }

    const docType =
      documentType.isReadableSelectField && documentType.canUpdateField
        ? null
        : undefined;
    await uploadFiles(files, docType);
  };

  const handleFilesSelected = async (files: File[]) => {
    const docType = selectedDocType;
    handleNativePickerClosed();
    await uploadFiles(files, docType);
  };

  const openNativePicker = () => {
    setSelectedDocType(undefined);
    inputFileRef.current?.click();
  };

  const openPickerForDocType = (docType: string | null) => {
    setSelectedDocType(docType);
    flushSync(() => setIsNativePickerOpen(true));

    const input = inputFileRef.current;

    if (!input) {
      handleNativePickerClosed();
      return;
    }

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // The click fallback still uses the option's transient user activation.
      }
    }

    input.click();
  };

  const handleNativePickerClosed = () => {
    setIsNativePickerOpen(false);
    setSelectedDocType(undefined);
    closeDropdown(dropdownId);
  };

  const handleRequiredTypeSelected = (option: SelectOption) => {
    const files = pendingFiles;
    setPendingFiles([]);
    closeDialog(dialogId);
    void uploadFiles(files, option.value);
  };

  const handleRequiredDialogClose = () => {
    setPendingFiles([]);
  };

  const label = appearance === 'header' ? t`Attach file` : t`Add file`;
  const triggerAccessibleLabel = disabledReason
    ? `${label}. ${disabledReason}`
    : label;

  const renderButton = (disabled: boolean, onClick?: () => void) =>
    appearance === 'header' ? (
      <WidgetCardHeaderActionButton
        Icon={IconPaperclip}
        label={triggerAccessibleLabel}
        onClick={onClick}
        disabled={disabled}
        aria-describedby={disabledReason ? descriptionId : undefined}
      />
    ) : (
      <Button
        startIcon={<IconPlus />}
        onClick={onClick}
        variant="outline"
        disabled={disabled}
        title={disabledReason}
        aria-describedby={disabledReason ? descriptionId : undefined}
      >
        {label}
      </Button>
    );

  const trigger = !canUploadFiles ? null : canUseTypeOptions ? (
    <DropdownRoot
      dropdownId={dropdownId}
      type="menu"
      onInteractOutside={(event) => {
        if (isNativePickerOpen) {
          event.preventDefault();
        }
      }}
    >
      <Dropdown.Trigger render={renderButton(isTriggerDisabled)} />
      <DropdownContent align="start" width={GenericDropdownContentWidth.Narrow}>
        <SelectInput
          onOptionSelected={(option) => openPickerForDocType(option.value)}
          options={documentType.options}
          onClear={
            documentType.isNullable
              ? () => openPickerForDocType(null)
              : undefined
          }
          clearLabel={documentType.label}
          closeOnSelect={false}
        />
      </DropdownContent>
    </DropdownRoot>
  ) : (
    renderButton(isTriggerDisabled, openNativePicker)
  );

  const renderChildren = children?.({
    isUploading,
    canAcceptDroppedFiles,
    onUploadFiles: handleFilesDropped,
    trigger,
  });

  return (
    <>
      <AttachmentFileInput
        ref={inputFileRef}
        targetableObject={targetableObject}
        onFilesSelected={handleFilesSelected}
        onPickerCancelled={handleNativePickerClosed}
      />
      {disabledReason && (
        <StyledScreenReaderText id={descriptionId}>
          {disabledReason}
        </StyledScreenReaderText>
      )}
      {children ? renderChildren : trigger}
      <DialogInstance
        dialogId={dialogId}
        dismissible
        onClose={handleRequiredDialogClose}
      >
        {({ onKeyDown }) => (
          <Dialog.Popup
            aria-label={t({
              id: 'Choose {fieldLabel}',
              message: `Choose ${{ fieldLabel }}`,
            })}
            onKeyDown={onKeyDown}
            size="sm"
          >
            <Dialog.Header>
              <Dialog.Title>
                {t({
                  id: 'Choose {fieldLabel}',
                  message: `Choose ${{ fieldLabel }}`,
                })}
              </Dialog.Title>
              <Dialog.Description>
                {t({
                  id: 'Choose {fieldLabel} for {fileCount} files.',
                  message: `Choose ${{ fieldLabel }} for ${{ fileCount: pendingFiles.length }} files.`,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Dialog.Body>
              <DropdownRoot dropdownId={`${dialogId}-select`} type="menu">
                <Dropdown.Trigger
                  render={
                    <Button variant="outline">
                      {t({
                        id: 'Choose {fieldLabel}',
                        message: `Choose ${{ fieldLabel }}`,
                      })}
                    </Button>
                  }
                />
                <DropdownContent
                  align="start"
                  width={GenericDropdownContentWidth.Narrow}
                >
                  <SelectInput
                    onOptionSelected={handleRequiredTypeSelected}
                    options={documentType.options}
                    closeOnSelect
                  />
                </DropdownContent>
              </DropdownRoot>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="outline"
                onClick={() => {
                  setPendingFiles([]);
                  closeDialog(dialogId);
                }}
              >
                {t`Cancel`}
              </Button>
            </Dialog.Footer>
          </Dialog.Popup>
        )}
      </DialogInstance>
    </>
  );
};
