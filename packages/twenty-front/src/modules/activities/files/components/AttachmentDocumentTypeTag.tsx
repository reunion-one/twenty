import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { Tag } from 'twenty-ui/primitives/data-display';

type AttachmentDocumentTypeTagProps = {
  docType?: string | null;
};

const StyledTagContainer = styled.div`
  max-width: 10rem;
  min-width: 0;
  overflow: hidden;
`;

export const AttachmentDocumentTypeTag = ({
  docType,
}: AttachmentDocumentTypeTagProps) => {
  const { t } = useLingui();
  const documentType = useAttachmentDocumentType();
  if (!documentType.isReadableSelectField || !isDefined(docType)) {
    return null;
  }
  const selectedOption = documentType.options.find(
    (option) => option.value === docType,
  );
  const fieldLabel = documentType.label ?? t`type`;
  return (
    <StyledTagContainer>
      <Tag color={selectedOption?.color ?? 'gray'}>
        {selectedOption?.label ?? t`Unknown ${fieldLabel}`}
      </Tag>
    </StyledTagContainer>
  );
};
