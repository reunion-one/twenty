import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import {
  IconDotsVertical,
  IconDownload,
  IconPencil,
  IconTrash,
  useIcons,
} from 'twenty-ui/icon';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { LightIconButton } from 'twenty-ui/components/input';
import { Dropdown } from 'twenty-ui/components/navigation';
import { SelectInput } from '@/ui/input/components/SelectInput';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { useToast } from 'twenty-ui/components/feedback';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { type Attachment } from '@/activities/files/types/Attachment';

type AttachmentDropdownProps = {
  attachmentId: string;
  onDownload: () => void;
  onDelete: () => void;
  onRename: () => void;
  hasDownloadPermission: boolean;
  docType?: string | null;
};

export const AttachmentDropdown = ({
  attachmentId,
  onDownload,
  onDelete,
  onRename,
  hasDownloadPermission,
  docType,
}: AttachmentDropdownProps) => {
  const { t } = useLingui();
  const { enqueueToast } = useToast();
  const { updateOneRecord } = useUpdateOneRecord();
  const { closeDropdown } = useCloseDropdown();
  const { getIcon } = useIcons();
  const documentType = useAttachmentDocumentType();
  const DocumentTypeIcon = getIcon(documentType.icon);
  const [isUpdatingDocType, setIsUpdatingDocType] = useState(false);
  const dropdownId = `${attachmentId}-attachment-dropdown`;
  const fieldLabel = documentType.label ?? 'type';
  const documentTypeDescription =
    documentType.options.find((option) => option.value === docType)?.label ??
    (docType !== null && docType !== undefined
      ? t({
          id: 'Unknown {fieldLabel}',
          message: `Unknown ${{ fieldLabel }}`,
        })
      : undefined);

  const handleDocumentTypeChange = async (value: string | null) => {
    if (isUpdatingDocType) {
      return;
    }

    setIsUpdatingDocType(true);

    try {
      await updateOneRecord<Attachment>({
        objectNameSingular: CoreObjectNameSingular.Attachment,
        idToUpdate: attachmentId,
        updateOneRecordInput: { docType: value },
      });
      closeDropdown(dropdownId);
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
    } finally {
      setIsUpdatingDocType(false);
    }
  };

  return (
    <DropdownRoot dropdownId={dropdownId} type="menu">
      <Dropdown.Trigger
        render={
          <LightIconButton emphasis="subtle" aria-label={t`More options`}>
            <IconDotsVertical />
          </LightIconButton>
        }
      />
      <DropdownContent align="end" width={GenericDropdownContentWidth.Medium}>
        <Dropdown.Section>
          {hasDownloadPermission && (
            <Dropdown.ActionItem
              startIcon={<IconDownload />}
              onClick={onDownload}
            >
              {t`Download`}
            </Dropdown.ActionItem>
          )}
          {documentType.isReadableSelectField &&
            documentType.canUpdateField && (
              <Dropdown.Submenu>
                <Dropdown.SubmenuTrigger
                  disabled={isUpdatingDocType}
                  description={documentTypeDescription}
                  startIcon={<DocumentTypeIcon />}
                  aria-label={
                    documentTypeDescription
                      ? `${fieldLabel} · ${documentTypeDescription}`
                      : fieldLabel
                  }
                >
                  {fieldLabel}
                </Dropdown.SubmenuTrigger>
                <Dropdown.Content aria-label={fieldLabel}>
                  <SelectInput
                    onOptionSelected={(option) =>
                      void handleDocumentTypeChange(option.value)
                    }
                    options={documentType.options}
                    value={docType}
                    onClear={
                      documentType.isNullable
                        ? () => void handleDocumentTypeChange(null)
                        : undefined
                    }
                    clearLabel={fieldLabel}
                  />
                </Dropdown.Content>
              </Dropdown.Submenu>
            )}
          <Dropdown.ActionItem startIcon={<IconPencil />} onClick={onRename}>
            {t`Rename`}
          </Dropdown.ActionItem>
          <Dropdown.ActionItem
            color="danger"
            startIcon={<IconTrash />}
            onClick={onDelete}
          >
            {t`Delete`}
          </Dropdown.ActionItem>
        </Dropdown.Section>
      </DropdownContent>
    </DropdownRoot>
  );
};
