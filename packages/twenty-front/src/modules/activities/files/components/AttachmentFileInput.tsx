import { useUploadAttachmentFiles } from '@/activities/files/hooks/useUploadAttachmentFiles';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { styled } from '@linaria/react';
import {
  type ChangeEvent,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components/feedback';

const StyledFileInput = styled.input`
  display: none;
`;

type AttachmentFileInputProps = {
  ref?: Ref<HTMLInputElement>;
  targetableObject: ActivityTargetableObject;
  docType?: string | null;
  onFilesSelected?: (files: File[]) => void | Promise<void>;
  onPickerCancelled?: () => void;
  onUploadComplete?: () => void;
};

export const AttachmentFileInput = ({
  ref,
  targetableObject,
  docType,
  onFilesSelected,
  onPickerCancelled,
  onUploadComplete,
}: AttachmentFileInputProps) => {
  const { uploadAttachmentFiles } = useUploadAttachmentFiles();
  const { enqueueToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    const input = inputRef.current;
    if (!isDefined(input) || !isDefined(onPickerCancelled)) {
      return;
    }

    input.addEventListener('cancel', onPickerCancelled);

    return () => input.removeEventListener('cancel', onPickerCancelled);
  }, [onPickerCancelled]);

  const handleFileInputChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = isDefined(event.target.files)
      ? Array.from(event.target.files)
      : [];
    event.target.value = '';

    if (files.length === 0) {
      onPickerCancelled?.();
      return;
    }

    if (isDefined(onFilesSelected)) {
      await onFilesSelected(files);
      return;
    }

    try {
      await uploadAttachmentFiles({ files, targetableObject, docType });
      onUploadComplete?.();
    } catch (error) {
      enqueueToast(getToastOptionsFromError({ error }));
    }
  };

  return (
    <StyledFileInput
      ref={inputRef}
      onChange={handleFileInputChange}
      type="file"
      multiple
    />
  );
};
