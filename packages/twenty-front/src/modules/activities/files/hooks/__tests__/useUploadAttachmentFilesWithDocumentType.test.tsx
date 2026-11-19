import { renderHook } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { type ReactNode } from 'react';

import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useCanUploadAttachmentFiles } from '@/activities/files/hooks/useCanUploadAttachmentFiles';
import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { useUploadAttachmentFilesWithDocumentType } from '@/activities/files/hooks/useUploadAttachmentFilesWithDocumentType';
import { MAX_ATTACHMENT_SIZE } from '@/advanced-text-editor/utils/maxAttachmentSize';
import { formatFileSize } from '@/file/utils/formatFileSize';

jest.mock('@/activities/files/hooks/useAttachmentDocumentType');
jest.mock('@/activities/files/hooks/useCanUploadAttachmentFiles');
jest.mock('@/activities/files/hooks/useUploadAttachmentFile');

const targetableObject = {
  id: 'company-id',
  targetObjectNameSingular: 'company',
};
const documentType = {
  hasFieldMetadata: true,
  isSelectField: true,
  isReadableSelectField: true,
  canReadField: true,
  canUpdateField: true,
  isNullable: false,
  label: 'Document type',
  icon: 'IconTag',
  options: [
    {
      id: 'contract-option',
      value: 'contract',
      label: 'Contract',
      color: 'blue',
      position: 0,
    },
  ],
  selectableOptions: [
    {
      id: 'contract-option',
      value: 'contract',
      label: 'Contract',
      color: 'blue',
      position: 0,
    },
  ],
} satisfies ReturnType<typeof useAttachmentDocumentType>;
const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);

describe('useUploadAttachmentFilesWithDocumentType @custom', () => {
  const uploadAttachmentFile = jest.fn();
  const file = new File(['content'], 'contract.pdf');

  beforeEach(() => {
    jest.resetAllMocks();
    i18n.loadAndActivate({ locale: 'en', messages: {} });
    jest.mocked(useAttachmentDocumentType).mockReturnValue(documentType);
    jest
      .mocked(useCanUploadAttachmentFiles)
      .mockReturnValue({ canUploadFiles: true });
    jest
      .mocked(useUploadAttachmentFile)
      .mockReturnValue({ uploadAttachmentFile });
    uploadAttachmentFile.mockResolvedValue(undefined);
  });

  const renderUpload = () =>
    renderHook(
      () => useUploadAttachmentFilesWithDocumentType({ targetableObject }),
      { wrapper },
    );

  it('uploads a valid option for system-managed attachments', async () => {
    const { result } = renderUpload();

    await result.current.uploadFiles([file], 'contract');

    expect(uploadAttachmentFile).toHaveBeenCalledWith(
      file,
      targetableObject,
      'contract',
    );
  });

  it('blocks stale options, missing required values, and missing field write permission before upload', async () => {
    const { result, rerender } = renderUpload();

    await expect(result.current.uploadFiles([file], 'removed')).rejects.toThrow(
      'The selected Document type is no longer available.',
    );
    await expect(result.current.uploadFiles([file])).rejects.toThrow(
      'A value is required for Document type.',
    );
    await expect(result.current.uploadFiles([file], null)).rejects.toThrow(
      'A value is required for Document type.',
    );
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, canUpdateField: false });
    rerender();

    await expect(
      result.current.uploadFiles([file], 'contract'),
    ).rejects.toThrow('Document type is no longer available for this file.');
    expect(uploadAttachmentFile).not.toHaveBeenCalled();
  });

  it('uses readable labels without exposing unreadable metadata', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, label: 'Attachment category' });
    const { result, rerender } = renderUpload();

    await expect(result.current.uploadFiles([file], 'removed')).rejects.toThrow(
      'The selected Attachment category is no longer available.',
    );
    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      ...documentType,
      canReadField: false,
      isReadableSelectField: false,
      label: undefined,
      options: [],
      selectableOptions: [],
    });
    rerender();

    await expect(
      result.current.uploadFiles([file], 'contract'),
    ).rejects.toThrow('This field is no longer available for this file.');
    expect(uploadAttachmentFile).not.toHaveBeenCalled();
  });

  it('blocks upload without target upload permission', async () => {
    jest
      .mocked(useCanUploadAttachmentFiles)
      .mockReturnValue({ canUploadFiles: false });
    const { result } = renderUpload();

    await expect(
      result.current.uploadFiles([file], 'contract'),
    ).rejects.toThrow('You do not have permission to upload files here.');
    expect(uploadAttachmentFile).not.toHaveBeenCalled();
  });

  it('allows null for a nullable document type', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, isNullable: true });
    const { result } = renderUpload();

    await result.current.uploadFiles([file], null);

    expect(uploadAttachmentFile).toHaveBeenCalledWith(
      file,
      targetableObject,
      null,
    );
  });

  it('uploads sequentially and stops at the first failed file', async () => {
    let finishFirstUpload: () => void = () => {};
    uploadAttachmentFile
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirstUpload = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('upload failed'));
    const files = [
      file,
      new File(['two'], 'two.pdf'),
      new File(['three'], 'three.pdf'),
    ];
    const { result } = renderUpload();

    const upload = result.current.uploadFiles(files, 'contract');
    expect(uploadAttachmentFile).toHaveBeenCalledTimes(1);
    finishFirstUpload();
    await expect(upload).rejects.toThrow('upload failed');

    expect(uploadAttachmentFile).toHaveBeenCalledTimes(2);
    expect(uploadAttachmentFile).toHaveBeenNthCalledWith(
      2,
      files[1],
      targetableObject,
      'contract',
    );
  });

  it('rejects an inactive option even when it exists in options', async () => {
    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      ...documentType,
      options: [{ ...documentType.options[0], isActive: false }],
      selectableOptions: [],
    });
    const { result } = renderUpload();

    await expect(
      result.current.uploadFiles([file], 'contract'),
    ).rejects.toThrow('The selected Document type is no longer available.');
    expect(uploadAttachmentFile).not.toHaveBeenCalled();
  });

  it('rejects any oversize file before permission checks or uploads', async () => {
    const oversizeFile = new File(['content'], 'large.pdf');
    Object.defineProperty(oversizeFile, 'size', {
      value: MAX_ATTACHMENT_SIZE + 1,
    });
    jest
      .mocked(useCanUploadAttachmentFiles)
      .mockReturnValue({ canUploadFiles: false });
    const { result } = renderUpload();

    await expect(
      result.current.uploadFiles([file, oversizeFile], 'contract'),
    ).rejects.toThrow(formatFileSize(MAX_ATTACHMENT_SIZE));
    expect(uploadAttachmentFile).not.toHaveBeenCalled();
  });

  it('rejects a supplied type after the field stops being a SELECT', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, isSelectField: false });
    const { result } = renderUpload();

    await expect(
      result.current.uploadFiles([file], 'contract'),
    ).rejects.toThrow('Document type is no longer available for this file.');
    expect(uploadAttachmentFile).not.toHaveBeenCalled();
  });
});
