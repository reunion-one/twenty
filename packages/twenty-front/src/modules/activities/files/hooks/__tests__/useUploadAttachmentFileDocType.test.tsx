import { renderHook } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { type ReactNode } from 'react';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { useDirectFileUpload } from '@/file/hooks/useDirectFileUpload';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { FieldMetadataType } from '~/generated-metadata/graphql';

jest.mock('@/file/hooks/useDirectFileUpload');
jest.mock('@/object-record/hooks/useCreateOneRecord', () => ({
  useCreateOneRecord: jest.fn(),
}));
jest.mock('@/object-metadata/hooks/useObjectMetadataItem');

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);

describe('useUploadAttachmentFile docType pass-through @custom', () => {
  const directUploadFile = jest.fn();
  const createOneRecord = jest.fn();
  const targetableObject = {
    id: 'company-id',
    targetObjectNameSingular: 'company',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    i18n.loadAndActivate({ locale: 'en', messages: {} });
    directUploadFile.mockResolvedValue({
      id: 'uploaded-file-id',
      url: '/file',
    });
    jest.mocked(useDirectFileUpload).mockReturnValue({
      uploadFile: directUploadFile,
      createFileUploadAndPutFile: jest.fn(),
    });
    jest
      .mocked(useCreateOneRecord)
      .mockReturnValue({ createOneRecord, loading: false });
    const attachmentMetadata = getMockObjectMetadataItemOrThrow('attachment');
    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: {
        ...attachmentMetadata,
        isUICreatable: false,
        fields: [
          ...attachmentMetadata.fields,
          {
            ...attachmentMetadata.fields[0],
            id: 'doc-type-field',
            name: 'docType',
            type: FieldMetadataType.SELECT,
            isNullable: false,
            options: [],
          },
        ],
      },
    });
  });

  it.each(['removed-option', null, undefined])(
    'passes through %s without validating a required field',
    async (docType) => {
      const { result } = renderHook(() => useUploadAttachmentFile(), {
        wrapper,
      });

      await result.current.uploadAttachmentFile(
        new File(['image'], 'image.png'),
        targetableObject,
        docType,
      );

      expect(directUploadFile).toHaveBeenCalledTimes(1);
      expect(createOneRecord).toHaveBeenCalledTimes(1);
      if (docType === undefined) {
        expect(createOneRecord.mock.calls[0][0]).not.toHaveProperty('docType');
      } else {
        expect(createOneRecord.mock.calls[0][0]).toHaveProperty(
          'docType',
          docType,
        );
      }
    },
  );
});
