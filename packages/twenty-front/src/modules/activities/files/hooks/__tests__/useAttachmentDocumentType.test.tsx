import { renderHook } from '@testing-library/react';

import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { FieldMetadataType } from '~/generated-metadata/graphql';

jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: jest.fn(),
}));
jest.mock('@/object-record/hooks/useObjectPermissionsForObject', () => ({
  useObjectPermissionsForObject: jest.fn(),
}));

const makeMetadata = (
  field: Record<string, unknown> | undefined,
): EnrichedObjectMetadataItem =>
  ({
    id: 'attachment-object',
    fields: field ? [field] : [],
  }) as unknown as EnrichedObjectMetadataItem;

describe('useAttachmentDocumentType @custom', () => {
  beforeEach(() => {
    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: makeMetadata({
        id: 'doc-type-field',
        name: 'docType',
        type: FieldMetadataType.SELECT,
        isActive: true,
        isNullable: true,
        icon: 'IconUser',
        label: 'Document type',
        options: [
          { value: 'contract', label: 'Contract', color: 'blue', position: 2 },
          { value: 'invoice', label: 'Invoice', color: 'red', position: 1 },
        ],
      }),
    });
    jest.mocked(useObjectPermissionsForObject).mockReturnValue({
      restrictedFields: {},
    } as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the readable SELECT metadata and sorts options by position', () => {
    const { result } = renderHook(() => useAttachmentDocumentType());

    expect(result.current).toMatchObject({
      isSelectField: true,
      isReadableSelectField: true,
      canReadField: true,
      canUpdateField: true,
      isNullable: true,
      icon: 'IconUser',
      label: 'Document type',
      options: [
        { value: 'invoice', label: 'Invoice', color: 'red' },
        { value: 'contract', label: 'Contract', color: 'blue' },
      ],
    });
  });

  it('hides labels and options when the field is unreadable', () => {
    jest.mocked(useObjectPermissionsForObject).mockReturnValue({
      restrictedFields: {
        'doc-type-field': { canRead: false, canUpdate: false },
      },
    } as never);

    const { result } = renderHook(() => useAttachmentDocumentType());

    expect(result.current).toMatchObject({
      isSelectField: true,
      canReadField: false,
      canUpdateField: false,
      label: undefined,
      icon: undefined,
      options: [],
    });
    expect(result.current).not.toHaveProperty('fieldMetadata');
  });

  it('keeps readable metadata available when the field is not updatable', () => {
    jest.mocked(useObjectPermissionsForObject).mockReturnValue({
      restrictedFields: {
        'doc-type-field': { canRead: true, canUpdate: false },
      },
    } as never);

    const { result } = renderHook(() => useAttachmentDocumentType());

    expect(result.current).toMatchObject({
      canReadField: true,
      canUpdateField: false,
      icon: 'IconUser',
      label: 'Document type',
      options: [
        { value: 'invoice', label: 'Invoice', color: 'red' },
        { value: 'contract', label: 'Contract', color: 'blue' },
      ],
    });
  });

  it('reacts to metadata changes and warns once for an invalid field', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: makeMetadata(undefined),
    });
    const { result, rerender } = renderHook(() => useAttachmentDocumentType());

    expect(result.current.isSelectField).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);

    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: makeMetadata({
        id: 'doc-type-field',
        name: 'docType',
        type: FieldMetadataType.SELECT,
        isActive: true,
        isNullable: false,
        icon: 'IconBuildingSkyscraper',
        label: 'Category',
        options: [
          { value: 'memo', label: 'Memo', color: 'green', position: 0 },
        ],
      }),
    });
    rerender();

    expect(result.current).toMatchObject({
      label: 'Category',
      icon: 'IconBuildingSkyscraper',
      isNullable: false,
      options: [{ value: 'memo', label: 'Memo', color: 'green' }],
    });

    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: makeMetadata({
        id: 'doc-type-field',
        name: 'docType',
        type: FieldMetadataType.SELECT,
        isActive: true,
        isNullable: true,
        icon: 'IconTag',
        label: 'File category',
        options: [
          {
            value: 'agreement',
            label: 'Agreement',
            color: 'gold',
            position: 0,
          },
        ],
      }),
    });
    rerender();

    expect(result.current).toMatchObject({
      label: 'File category',
      icon: 'IconTag',
      isNullable: true,
      options: [{ value: 'agreement', label: 'Agreement', color: 'gold' }],
    });

    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: makeMetadata({
        id: 'doc-type-field',
        name: 'docType',
        type: FieldMetadataType.TEXT,
        isActive: true,
      }),
    });
    rerender();
    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: makeMetadata(undefined),
    });
    rerender();

    expect(result.current).toMatchObject({
      isSelectField: false,
      label: undefined,
      options: [],
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
