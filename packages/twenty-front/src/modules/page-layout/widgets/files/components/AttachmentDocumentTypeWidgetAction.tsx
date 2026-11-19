import { AttachmentDocumentTypeUploadTrigger } from '@/activities/files/components/AttachmentDocumentTypeUploadTrigger';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useCanUploadAttachmentFiles } from '@/activities/files/hooks/useCanUploadAttachmentFiles';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { WidgetCardHeaderActionButton } from '@/page-layout/widgets/widget-card/components/WidgetCardHeaderActionButton';
import { useLingui } from '@lingui/react/macro';
import { type ReactNode } from 'react';
import { IconPlus } from 'twenty-ui/icon';

type AttachmentDocumentTypeWidgetActionProps = {
  targetRecord: ActivityTargetableObject;
  fallback: ReactNode;
};

export const AttachmentDocumentTypeWidgetAction = ({
  targetRecord,
  fallback,
}: AttachmentDocumentTypeWidgetActionProps) => {
  const { t } = useLingui();
  const { isSelectField } = useAttachmentDocumentType();
  const { canUploadFiles } = useCanUploadAttachmentFiles(targetRecord);
  if (!isSelectField) {
    return fallback;
  }
  if (!canUploadFiles) {
    return null;
  }
  return (
    <AttachmentDocumentTypeUploadTrigger targetableObject={targetRecord}>
      {({ openFilePicker, disabled, disabledReason, describedById }) => (
        <WidgetCardHeaderActionButton
          Icon={IconPlus}
          label={
            disabledReason
              ? `${t`Attach file`}. ${disabledReason}`
              : t`Attach file`
          }
          onClick={openFilePicker}
          disabled={disabled}
          aria-describedby={describedById}
        />
      )}
    </AttachmentDocumentTypeUploadTrigger>
  );
};
