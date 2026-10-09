import { ActivityRow } from '@/activities/components/ActivityRow';
import { AttachmentDropdown } from '@/activities/files/components/AttachmentDropdown';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { downloadFile } from '@/activities/files/utils/downloadFile';
import { useDestroyOneRecord } from '@/object-record/hooks/useDestroyOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import {
  FieldContext,
  type GenericFieldContextType,
} from '@/object-record/record-field/ui/contexts/FieldContext';
import { getFileCategoryFromExtension } from '@/object-record/record-field/ui/utils/getFileCategoryFromExtension';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { styled } from '@linaria/react';
import { useState } from 'react';
import { getSafeUrl, isDefined } from 'twenty-shared/utils';

import { type AttachmentWithFile } from '@/activities/files/utils/filterAttachmentsWithFile';
import { FileIcon } from '@/file/components/FileIcon';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { isNavigationModifierPressed } from '@/ui/navigation/utils/isNavigationModifierPressed';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { OverflowingTextWithTooltip } from 'twenty-ui/primitives/typography';
import { IconCalendar } from 'twenty-ui/icon';
import { useTheme, themeCssVariables } from 'twenty-ui/theme';
import { Tag } from 'twenty-ui/primitives/data-display';
import { PermissionFlagType } from '~/generated-metadata/graphql';
import { formatToHumanReadableDate } from '~/utils/date-utils';
import { getFileNameAndExtension } from '~/utils/file/getFileNameAndExtension';
import { openUrlInNewTab } from '~/utils/openUrlInNewTab';
import { useLingui } from '@lingui/react/macro';

const StyledLeftContent = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing[3]};
  min-width: 0;
  overflow: hidden;
  width: 100%;
`;

const StyledNameLine = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
  overflow: hidden;
`;

const StyledRightContent = styled.div`
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: ${themeCssVariables.spacing[2]};
  margin-left: auto;
`;

const StyledDateContent = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing['0.5']};
  white-space: nowrap;
`;

const StyledCalendarIconContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.light};
  display: flex;
`;

const StyledLink = styled.a`
  align-items: center;
  appearance: none;
  background: none;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-family: inherit;
  font-size: inherit;
  padding: 0;
  text-align: left;
  text-decoration: none;
  width: 100%;

  :hover {
    color: ${themeCssVariables.font.color.secondary};
  }
`;

const StyledLinkContainer = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  width: 100%;
`;

const StyledDocumentTypeTagContainer = styled.div`
  flex: 0 1 auto;
  max-width: 10rem;
  min-width: 0;
  overflow: hidden;

  & > span {
    max-width: 100%;
  }
`;

const StyledTextInputContainer = styled.div`
  flex: 1;
  min-width: 0;
  width: 100%;
`;

type AttachmentRowProps = {
  attachment: AttachmentWithFile;
  onPreview?: (attachment: AttachmentWithFile) => void;
};

export const AttachmentRow = ({
  attachment,
  onPreview,
}: AttachmentRowProps) => {
  const theme = useTheme();
  const { t } = useLingui();
  const [isEditing, setIsEditing] = useState(false);
  const documentType = useAttachmentDocumentType();

  const hasDownloadPermission = useHasPermissionFlag(
    PermissionFlagType.DOWNLOAD_FILE,
  );

  const { name: originalFileName, extension: attachmentFileExtension } =
    getFileNameAndExtension(attachment.file.label);

  const [attachmentFileName, setAttachmentFileName] =
    useState(originalFileName);

  const fileCategory = getFileCategoryFromExtension(attachment.file.extension);

  const documentTypeOption = documentType.options.find(
    (option) => option.value === attachment.docType,
  );
  const showDocumentTypeTag =
    documentType.isReadableSelectField &&
    attachment.docType !== null &&
    attachment.docType !== undefined;

  const fileUrl = attachment.file.url;
  const safeFileUrl = getSafeUrl(fileUrl);

  const { destroyOneRecord: destroyOneAttachment } = useDestroyOneRecord({
    objectNameSingular: CoreObjectNameSingular.Attachment,
  });

  const handleDelete = () => {
    destroyOneAttachment(attachment.id);
  };

  const { updateOneRecord } = useUpdateOneRecord();

  const handleRename = () => {
    setIsEditing(true);
  };

  const saveAttachmentName = () => {
    setIsEditing(false);

    const newFileName = `${attachmentFileName}${attachmentFileExtension}`;

    updateOneRecord({
      objectNameSingular: CoreObjectNameSingular.Attachment,
      idToUpdate: attachment.id,
      updateOneRecordInput: {
        name: newFileName,
        file: [
          {
            fileId: attachment.file.fileId,
            label: newFileName,
          },
        ],
      },
    });
  };

  const handleOnBlur = () => {
    saveAttachmentName();
  };

  const handleOnChange = (newFileName: string) => {
    setAttachmentFileName(newFileName);
  };

  const handleOnKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter') {
      saveAttachmentName();
    }
  };

  const handleDownload = () => {
    downloadFile(fileUrl, `${attachmentFileName}${attachmentFileExtension}`);
  };

  const handleRowClick = () => {
    if (isDefined(onPreview)) {
      onPreview(attachment);
      return;
    }

    if (!isDefined(safeFileUrl)) {
      return;
    }

    openUrlInNewTab(safeFileUrl);
  };

  const handleFileLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();

    // Cmd/Ctrl+click opens new tab, right click opens context menu
    if (isNavigationModifierPressed(event) === true) {
      return;
    }

    if (isDefined(onPreview)) {
      event.preventDefault();
      onPreview(attachment);
    }
  };

  return (
    <FieldContext.Provider
      value={
        {
          recordId: attachment.id,
        } as GenericFieldContextType
      }
    >
      <ActivityRow onClick={handleRowClick} disabled={isEditing}>
        <StyledLeftContent>
          <FileIcon fileCategory={fileCategory} thumbnailUrl={fileUrl} />
          <StyledNameLine>
            {isEditing ? (
              <StyledTextInputContainer
                onClick={(event) => event.stopPropagation()}
              >
                <SettingsTextInput
                  instanceId={`attachment-${attachment.id}-name`}
                  value={attachmentFileName}
                  onChange={handleOnChange}
                  onBlur={handleOnBlur}
                  autoFocus
                  onKeyDown={handleOnKeyDown}
                />
              </StyledTextInputContainer>
            ) : (
              <StyledLinkContainer>
                <StyledLink
                  onClick={handleFileLinkClick}
                  href={safeFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OverflowingTextWithTooltip
                    text={`${attachmentFileName}${attachmentFileExtension}`}
                  />
                </StyledLink>
              </StyledLinkContainer>
            )}
          </StyledNameLine>
        </StyledLeftContent>
        <StyledRightContent>
          {showDocumentTypeTag && (
            <StyledDocumentTypeTagContainer>
              <Tag color={documentTypeOption?.color ?? 'gray'}>
                {documentTypeOption?.label ??
                  t({
                    id: 'Unknown {fieldLabel}',
                    message: `Unknown ${{ fieldLabel: documentType.label ?? 'type' }}`,
                  })}
              </Tag>
            </StyledDocumentTypeTagContainer>
          )}
          <StyledDateContent>
            <StyledCalendarIconContainer>
              <IconCalendar size={theme.icon.size.md} />
            </StyledCalendarIconContainer>
            <time dateTime={attachment.createdAt}>
              {formatToHumanReadableDate(attachment.createdAt)}
            </time>
          </StyledDateContent>
          <AttachmentDropdown
            attachmentId={attachment.id}
            onDelete={handleDelete}
            onDownload={handleDownload}
            onRename={handleRename}
            hasDownloadPermission={hasDownloadPermission}
            docType={attachment.docType}
          />
        </StyledRightContent>
      </ActivityRow>
    </FieldContext.Provider>
  );
};
