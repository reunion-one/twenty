import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { type Attachment } from '@/activities/files/types/Attachment';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { filterSelectableFieldOptions } from '@/object-record/record-field/ui/utils/filterSelectableFieldOptions';
import { SelectInput } from '@/ui/input/components/SelectInput';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { StandardObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components/feedback';
import { Dropdown } from 'twenty-ui/components/navigation';
import { useIcons } from 'twenty-ui/icon/provider';

type AttachmentDocumentTypeSubmenuProps = {
  attachmentId: string;
  docType?: string | null;
};

export const AttachmentDocumentTypeSubmenu = ({
  attachmentId,
  docType,
}: AttachmentDocumentTypeSubmenuProps) => {
  const { t } = useLingui();
  const documentType = useAttachmentDocumentType();
  const { updateOneRecord } = useUpdateOneRecord();
  const { closeDropdown } = useCloseDropdown();
  const { enqueueToast } = useToast();
  const { getIcon } = useIcons();
  const DocumentTypeIcon = getIcon(documentType.icon);
  const [isUpdating, setIsUpdating] = useState(false);
  const fieldLabel = documentType.label ?? t`type`;
  const description =
    documentType.options.find((option) => option.value === docType)?.label ??
    (isDefined(docType) ? t`Unknown ${fieldLabel}` : undefined);

  const handleChange = async (value: string | null) => {
    if (isUpdating) {
      return;
    }
    setIsUpdating(true);
    try {
      await updateOneRecord<Attachment>({
        objectNameSingular: StandardObjectNameSingular.Attachment,
        idToUpdate: attachmentId,
        updateOneRecordInput: { docType: value },
      });
      closeDropdown(`${attachmentId}-attachment-dropdown`);
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!documentType.isReadableSelectField || !documentType.canUpdateField) {
    return null;
  }
  return (
    <Dropdown.Submenu>
      <Dropdown.SubmenuTrigger
        disabled={isUpdating}
        description={description}
        startIcon={<DocumentTypeIcon />}
        aria-label={description ? `${fieldLabel} · ${description}` : fieldLabel}
      >
        {fieldLabel}
      </Dropdown.SubmenuTrigger>
      <Dropdown.Content aria-label={fieldLabel}>
        <SelectInput
          options={filterSelectableFieldOptions({
            options: documentType.options,
            selectedValues: docType ? [docType] : [],
          })}
          value={docType}
          onOptionSelected={(option) => void handleChange(option.value)}
          onClear={
            documentType.isNullable ? () => void handleChange(null) : undefined
          }
          clearLabel={fieldLabel}
        />
      </Dropdown.Content>
    </Dropdown.Submenu>
  );
};
