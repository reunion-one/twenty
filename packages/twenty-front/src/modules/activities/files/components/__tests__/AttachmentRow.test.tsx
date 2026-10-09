import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { ThemeProvider, themeCssVariables } from 'twenty-ui/theme';

import { AttachmentRow } from '@/activities/files/components/AttachmentRow';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { type AttachmentWithFile } from '@/activities/files/utils/filterAttachmentsWithFile';

jest.mock('@/activities/files/hooks/useAttachmentDocumentType', () => ({
  useAttachmentDocumentType: jest.fn(),
}));
jest.mock('@/object-record/hooks/useDestroyOneRecord', () => ({
  useDestroyOneRecord: () => ({ destroyOneRecord: jest.fn() }),
}));
jest.mock('@/object-record/hooks/useUpdateOneRecord', () => ({
  useUpdateOneRecord: () => ({ updateOneRecord: jest.fn() }),
}));
jest.mock('@/settings/roles/hooks/useHasPermissionFlag', () => ({
  useHasPermissionFlag: () => true,
}));
jest.mock('@/activities/components/ActivityRow', () => ({
  ActivityRow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/file/components/FileIcon', () => ({
  FileIcon: () => <span>File icon</span>,
}));
jest.mock('@/activities/files/components/AttachmentDropdown', () => ({
  AttachmentDropdown: () => <button aria-label="More options" />,
}));

const attachment = {
  id: 'attachment-id',
  name: 'contract.pdf',
  docType: 'contract',
  fullPath: '/files/contract.pdf',
  fileCategory: 'TEXT_DOCUMENT',
  createdAt: '2024-01-01T00:00:00.000Z',
  __typename: 'Attachment',
  file: {
    fileId: 'file-id',
    label: 'contract.pdf',
    extension: 'pdf',
    url: '/files/contract.pdf',
  },
} satisfies AttachmentWithFile;

const setDocumentType = ({
  isReadableSelectField = true,
  options,
  label = 'Document type',
}: {
  isReadableSelectField?: boolean;
  options: { value: string; label: string; color: string }[];
  label?: string;
}) => {
  jest.mocked(useAttachmentDocumentType).mockReturnValue({
    isReadableSelectField,
    options,
    label: isReadableSelectField ? label : undefined,
  } as never);
};

const renderAttachmentRow = (docType: string | null | undefined) =>
  render(
    <I18nProvider i18n={i18n}>
      <ThemeProvider colorScheme="light">
        <AttachmentRow attachment={{ ...attachment, docType }} />
      </ThemeProvider>
    </I18nProvider>,
  );

describe('AttachmentRow document type tag @custom', () => {
  beforeEach(() => {
    setDocumentType({
      options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
    });
  });

  it('uses the current metadata label and color before the date', () => {
    const { container } = renderAttachmentRow('contract');

    const filename = screen.getByRole('link', { name: 'contract.pdf' });
    const typeTag = screen
      .getByText('Contract')
      .closest('[data-variant="soft"]');
    const date = container.querySelector('time');

    expect(typeTag).not.toBeNull();
    expect(date).not.toBeNull();
    expect(typeTag).toHaveStyle({
      '--tw-tag-background': themeCssVariables.tag.background.blue,
    });
    expect(
      typeTag!.compareDocumentPosition(date!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(filename).toBeInTheDocument();
    expect(screen.getByLabelText('More options')).toBeInTheDocument();
    expect(screen.getByText('File icon')).toBeInTheDocument();
  });

  it('shows a neutral translated label for stale values without exposing the stored value', () => {
    setDocumentType({
      label: 'Attachment category',
      options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
    });
    renderAttachmentRow('confidential-internal-value');

    const unknownTag = screen
      .getByText('Unknown Attachment category')
      .closest('[data-variant="soft"]');

    expect(unknownTag).not.toBeNull();
    expect(unknownTag).toHaveStyle({
      '--tw-tag-background': themeCssVariables.tag.background.gray,
    });
    expect(
      screen.queryByText('confidential-internal-value'),
    ).not.toBeInTheDocument();
  });

  it.each([
    { docType: null, readable: true },
    { docType: undefined, readable: true },
    { docType: 'contract', readable: false },
  ])(
    'hides tags for null, missing, or unreadable values',
    ({ docType, readable }) => {
      setDocumentType({
        isReadableSelectField: readable,
        options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
      });
      renderAttachmentRow(docType);

      expect(screen.queryByText('Contract')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Unknown Document type'),
      ).not.toBeInTheDocument();
    },
  );

  it('updates the tag when the current metadata changes', () => {
    const { rerender } = renderAttachmentRow('contract');

    expect(screen.getByText('Contract')).toBeInTheDocument();
    setDocumentType({
      options: [{ value: 'agreement', label: 'Agreement', color: 'green' }],
    });
    rerender(
      <I18nProvider i18n={i18n}>
        <ThemeProvider colorScheme="light">
          <AttachmentRow attachment={attachment} />
        </ThemeProvider>
      </I18nProvider>,
    );

    expect(screen.queryByText('Contract')).not.toBeInTheDocument();
    expect(screen.getByText('Unknown Document type')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'contract.pdf' }),
    ).toBeInTheDocument();
  });
});
