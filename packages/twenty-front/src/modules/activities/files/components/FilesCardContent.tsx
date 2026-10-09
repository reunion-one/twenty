import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { AttachmentUploader } from '@/activities/files/components/AttachmentUploader';
import { AttachmentList } from '@/activities/files/components/AttachmentList';
import { DropZone } from '@/activities/files/components/DropZone';
import { type Attachment } from '@/activities/files/types/Attachment';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { AnimatedPlaceholder } from '@/ui/feedback/empty-state/components/AnimatedPlaceholder/AnimatedPlaceholder';
import { EmptyState } from '@/ui/feedback/empty-state/components/EmptyState';
import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

const StyledAttachmentsContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`;

const StyledDropZoneContainer = styled.div`
  height: 100%;
`;

type FilesCardContentProps = {
  attachments: Attachment[];
  canUploadFiles: boolean;
  loading: boolean;
  targetRecord: ActivityTargetableObject;
};

export const FilesCardContent = ({
  attachments,
  canUploadFiles,
  loading,
  targetRecord,
}: FilesCardContentProps) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const isAttachmentsEmpty = attachments.length === 0;

  if (loading && isAttachmentsEmpty) {
    return <SkeletonLoader />;
  }

  return (
    <AttachmentUploader
      targetableObject={targetRecord}
      canUploadFiles={canUploadFiles}
      appearance="empty-state"
    >
      {({ canAcceptDroppedFiles, onUploadFiles, trigger }) =>
        isAttachmentsEmpty ? (
          <StyledDropZoneContainer
            onDragEnter={() => canAcceptDroppedFiles && setIsDraggingFile(true)}
          >
            {isDraggingFile && canAcceptDroppedFiles ? (
              <DropZone
                setIsDraggingFile={setIsDraggingFile}
                onUploadFiles={onUploadFiles}
              />
            ) : (
              <EmptyState.Root>
                <AnimatedPlaceholder type="noFile" />
                <EmptyState.Content>
                  <EmptyState.Title>
                    <Trans>No Files</Trans>
                  </EmptyState.Title>
                  <EmptyState.Description>
                    <Trans>
                      There are no associated files with this record.
                    </Trans>
                  </EmptyState.Description>
                </EmptyState.Content>
                {canUploadFiles && trigger}
              </EmptyState.Root>
            )}
          </StyledDropZoneContainer>
        ) : (
          <StyledAttachmentsContainer>
            <AttachmentList
              attachments={attachments}
              canUploadFiles={canAcceptDroppedFiles}
              onUploadFiles={onUploadFiles}
            />
          </StyledAttachmentsContainer>
        )
      }
    </AttachmentUploader>
  );
};
