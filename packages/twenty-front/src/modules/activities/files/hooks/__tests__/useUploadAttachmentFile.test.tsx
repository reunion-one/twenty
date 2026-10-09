import { act, renderHook } from '@testing-library/react';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useDirectFileUpload } from '@/file/hooks/useDirectFileUpload';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import {
  FieldMetadataType,
  MetadataWritability,
} from '~/generated-metadata/graphql';

jest.mock('@/activities/files/hooks/useAttachmentDocumentType', () => ({
  useAttachmentDocumentType: jest.fn(),
}));
jest.mock('@/file/hooks/useDirectFileUpload', () => ({
  useDirectFileUpload: jest.fn(),
}));
jest.mock('@/object-record/hooks/useCreateOneRecord', () => ({
  useCreateOneRecord: jest.fn(),
}));
jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: jest.fn(),
}));
jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: jest.fn(),
}));
jest.mock('@/object-record/hooks/useObjectPermissions', () => ({
  useObjectPermissions: jest.fn(),
}));
jest.mock('@/settings/roles/hooks/useHasPermissionFlag', () => ({
  useHasPermissionFlag: jest.fn(),
}));

const attachmentMetadata = {
  id: 'attachment-metadata-id',
  fields: [
    {
      id: 'file-field-id',
      name: 'file',
      type: FieldMetadataType.FILES,
    },
  ],
  isUICreatable: false,
  isUIEditable: true,
  isRemote: false,
  writability: MetadataWritability.OPEN,
} as unknown as EnrichedObjectMetadataItem;

const targetableObject = {
  id: 'company-id',
  targetObjectNameSingular: 'company',
} as ActivityTargetableObject;

describe('useUploadAttachmentFile @custom', () => {
  const directUploadFile = jest.fn();
  const createOneRecord = jest.fn();

  beforeEach(() => {
    directUploadFile.mockResolvedValue({
      id: 'uploaded-file-id',
      url: '/file',
    });
    createOneRecord.mockResolvedValue({ id: 'attachment-id' });
    jest.mocked(useDirectFileUpload).mockReturnValue({
      uploadFile: directUploadFile,
    } as never);
    jest.mocked(useCreateOneRecord).mockReturnValue({
      createOneRecord,
    } as never);
    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: attachmentMetadata,
    });
    jest.mocked(useObjectMetadataItems).mockReturnValue({
      objectMetadataItems: [
        {
          id: 'company-metadata-id',
          nameSingular: 'company',
          isUIEditable: true,
          isRemote: false,
          writability: MetadataWritability.OPEN,
        } as EnrichedObjectMetadataItem,
      ],
    } as never);
    jest.mocked(useObjectPermissions).mockReturnValue({
      objectPermissionsByObjectMetadataId: {
        'company-metadata-id': { canUpdateObjectRecords: true },
      },
    } as never);
    jest.mocked(useHasPermissionFlag).mockReturnValue(true);
    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      hasFieldMetadata: true,
      isSelectField: true,
      isReadableSelectField: true,
      canReadField: true,
      canUpdateField: true,
      isNullable: false,
      label: 'Document type',
      options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
    } as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('validates the current option before binary upload and writes it on creation', async () => {
    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: { ...attachmentMetadata, isUICreatable: true },
    });
    const { result } = renderHook(() => useUploadAttachmentFile());
    const file = new File(['content'], 'contract.pdf');

    await act(async () => {
      await result.current.uploadAttachmentFile(
        file,
        targetableObject,
        'contract',
      );
    });

    expect(directUploadFile).toHaveBeenCalledTimes(1);
    expect(createOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({ docType: 'contract' }),
    );
  });

  it('blocks stale options, missing required values, and missing field write permission before binary upload', async () => {
    const { result, rerender } = renderHook(() => useUploadAttachmentFile());
    const file = new File(['content'], 'contract.pdf');

    await expect(
      result.current.uploadAttachmentFile(file, targetableObject, 'removed'),
    ).rejects.toThrow('The selected Document type is no longer available.');
    await expect(
      result.current.uploadAttachmentFile(file, targetableObject),
    ).rejects.toThrow('A value is required for Document type.');

    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      hasFieldMetadata: true,
      isSelectField: true,
      isReadableSelectField: true,
      canReadField: true,
      canUpdateField: false,
      isNullable: false,
      label: 'Document type',
      options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
    } as never);
    rerender();

    await expect(
      result.current.uploadAttachmentFile(file, targetableObject, 'contract'),
    ).rejects.toThrow('Document type is no longer available for this file.');
    expect(directUploadFile).not.toHaveBeenCalled();
  });

  it('uses the readable field label in upload errors without exposing unreadable metadata', async () => {
    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      hasFieldMetadata: true,
      isSelectField: true,
      isReadableSelectField: true,
      canReadField: true,
      canUpdateField: true,
      isNullable: false,
      label: 'Attachment category',
      options: [],
    } as never);
    const { result, rerender } = renderHook(() => useUploadAttachmentFile());
    const file = new File(['content'], 'contract.pdf');

    await expect(
      result.current.uploadAttachmentFile(file, targetableObject, 'removed'),
    ).rejects.toThrow(
      'The selected Attachment category is no longer available.',
    );

    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      hasFieldMetadata: true,
      isSelectField: true,
      isReadableSelectField: false,
      canReadField: false,
      canUpdateField: false,
      isNullable: false,
      label: undefined,
      options: [],
    } as never);
    rerender();

    await expect(
      result.current.uploadAttachmentFile(file, targetableObject, 'contract'),
    ).rejects.toThrow('This field is no longer available for this file.');
    expect(directUploadFile).not.toHaveBeenCalled();
  });

  it('creates system-managed attachment records when the object is not UI creatable', async () => {
    const { result } = renderHook(() => useUploadAttachmentFile());

    await act(async () => {
      await result.current.uploadAttachmentFile(
        new File(['content'], 'contract.pdf'),
        targetableObject,
        'contract',
      );
    });

    expect(directUploadFile).toHaveBeenCalledTimes(1);
    expect(createOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({ docType: 'contract' }),
    );
  });

  it('allows null for a nullable document type and writes null explicitly', async () => {
    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      hasFieldMetadata: true,
      isSelectField: true,
      isReadableSelectField: true,
      canReadField: true,
      canUpdateField: true,
      isNullable: true,
      label: 'Document type',
      options: [],
    } as never);
    const { result } = renderHook(() => useUploadAttachmentFile());

    await act(async () => {
      await result.current.uploadAttachmentFile(
        new File(['content'], 'unclassified.pdf'),
        targetableObject,
        null,
      );
    });

    expect(createOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({ docType: null }),
    );
  });
});
