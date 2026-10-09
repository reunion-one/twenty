import { act, renderHook } from '@testing-library/react';

import { useUploadAttachmentFiles } from '@/activities/files/hooks/useUploadAttachmentFiles';
import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';

jest.mock('@/activities/files/hooks/useUploadAttachmentFile', () => ({
  useUploadAttachmentFile: jest.fn(),
}));

describe('useUploadAttachmentFiles @custom', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uploads sequentially and stops at the first failed file', async () => {
    const uploadAttachmentFile = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('upload failed'));
    jest.mocked(useUploadAttachmentFile).mockReturnValue({
      uploadAttachmentFile,
    });

    const files = [
      new File(['one'], 'one.pdf'),
      new File(['two'], 'two.pdf'),
      new File(['three'], 'three.pdf'),
    ];
    const targetableObject = {
      id: 'target-id',
      targetObjectNameSingular: 'company',
    };
    const { result } = renderHook(() => useUploadAttachmentFiles());

    let uploadError: unknown;
    await act(async () => {
      try {
        await result.current.uploadAttachmentFiles({
          files,
          targetableObject,
          docType: 'contract',
        });
      } catch (error) {
        uploadError = error;
      }
    });

    expect(uploadError).toEqual(new Error('upload failed'));
    expect(uploadAttachmentFile).toHaveBeenCalledTimes(2);
    expect(uploadAttachmentFile).toHaveBeenNthCalledWith(
      1,
      files[0],
      targetableObject,
      'contract',
    );
    expect(uploadAttachmentFile).toHaveBeenNthCalledWith(
      2,
      files[1],
      targetableObject,
      'contract',
    );
  });
});
