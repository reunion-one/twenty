import { AttachmentUploadTrigger } from '@/activities/files/components/AttachmentUploadTrigger';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useUploadAttachmentFilesWithDocumentType } from '@/activities/files/hooks/useUploadAttachmentFilesWithDocumentType';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { SelectInput } from '@/ui/input/components/SelectInput';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useLingui } from '@lingui/react/macro';
import {
  type ReactNode,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useToast } from 'twenty-ui/components/feedback';
import { Dropdown } from 'twenty-ui/components/navigation';
import { VisuallyHidden } from 'twenty-ui/primitives/accessibility';

type AttachmentDocumentTypeUploadTriggerProps = {
  targetableObject: ActivityTargetableObject;
  children: (props: {
    openFilePicker: () => void;
    disabled: boolean;
    disabledReason?: string;
    describedById?: string;
  }) => ReactNode;
  onUploadComplete?: () => void;
};

export const AttachmentDocumentTypeUploadTrigger = ({
  targetableObject,
  children,
  onUploadComplete,
}: AttachmentDocumentTypeUploadTriggerProps) => {
  const { t } = useLingui();
  const documentType = useAttachmentDocumentType();
  const { uploadFiles } = useUploadAttachmentFilesWithDocumentType({
    targetableObject,
  });
  const { enqueueToast } = useToast();
  const { closeDropdown } = useCloseDropdown();
  const instanceId = useId();
  const dropdownId = `attachment-document-type-upload-${instanceId}`;
  const descriptionId = `attachment-document-type-description-${instanceId}`;
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<
    string | null | undefined
  >(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [isNativePickerOpen, setIsNativePickerOpen] = useState(false);
  const canUseTypeOptions =
    documentType.isReadableSelectField && documentType.canUpdateField;
  const fieldLabel = documentType.label ?? t`this field`;
  const disabledReason = !canUseTypeOptions
    ? documentType.isNullable
      ? t`Files will be uploaded without ${fieldLabel} because you cannot set it.`
      : t`You need permission to set ${fieldLabel} before uploading files.`
    : !documentType.isNullable && documentType.selectableOptions.length === 0
      ? t`Add an option to ${fieldLabel} before uploading files.`
      : undefined;
  const disabled =
    isUploading ||
    (!documentType.isNullable &&
      (!canUseTypeOptions || documentType.selectableOptions.length === 0));

  const handleNativePickerClosed = useCallback(() => {
    setIsNativePickerOpen(false);
    setSelectedDocType(undefined);
    closeDropdown(dropdownId);
  }, [closeDropdown, dropdownId]);

  useEffect(() => {
    const input = inputFileRef.current;
    input?.addEventListener('cancel', handleNativePickerClosed);
    return () => input?.removeEventListener('cancel', handleNativePickerClosed);
  }, [handleNativePickerClosed, documentType.isSelectField]);

  const openPickerForDocType = (docType?: string | null) => {
    if (disabled) {
      return;
    }
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
        // Keep the option's transient user activation for the click fallback.
      }
    }
    input.click();
  };

  const handleFilesSelected = async (files: File[]) => {
    const docType = selectedDocType;
    handleNativePickerClosed();
    if (files.length === 0 || isUploading) {
      return;
    }
    setIsUploading(true);
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
      onUploadComplete?.();
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
    } finally {
      setIsUploading(false);
    }
  };

  if (!documentType.isSelectField) {
    return (
      <AttachmentUploadTrigger targetableObject={targetableObject}>
        {({ openFilePicker }) => children({ openFilePicker, disabled: false })}
      </AttachmentUploadTrigger>
    );
  }

  const triggerProps = {
    openFilePicker: () => {
      if (!canUseTypeOptions) {
        openPickerForDocType();
      }
    },
    disabled,
    disabledReason,
    describedById: disabledReason ? descriptionId : undefined,
  };

  const trigger = children(triggerProps);

  return (
    <>
      <input
        ref={inputFileRef}
        type="file"
        multiple
        hidden
        aria-label={t`Files`}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          void handleFilesSelected(files);
        }}
      />
      {disabledReason && (
        <VisuallyHidden id={descriptionId}>{disabledReason}</VisuallyHidden>
      )}
      {canUseTypeOptions ? (
        <DropdownRoot
          dropdownId={dropdownId}
          type="menu"
          onInteractOutside={(event) => {
            if (isNativePickerOpen) {
              event.preventDefault();
            }
          }}
        >
          {isValidElement(trigger) ? (
            <Dropdown.Trigger render={trigger} />
          ) : (
            trigger
          )}
          <DropdownContent
            align="start"
            width={GenericDropdownContentWidth.Narrow}
          >
            <SelectInput
              options={documentType.selectableOptions}
              onOptionSelected={(option) => openPickerForDocType(option.value)}
              onClear={
                documentType.isNullable
                  ? () => openPickerForDocType(null)
                  : undefined
              }
              clearLabel={documentType.label}
            />
          </DropdownContent>
        </DropdownRoot>
      ) : (
        trigger
      )}
    </>
  );
};
