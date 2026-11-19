import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import { AttachmentDocumentTypeTag } from '@/activities/files/components/AttachmentDocumentTypeTag';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { themeCssVariables } from 'twenty-ui/theme';

jest.mock('@/activities/files/hooks/useAttachmentDocumentType');
const documentType: ReturnType<typeof useAttachmentDocumentType> = {
  hasFieldMetadata: true,
  isSelectField: true,
  isReadableSelectField: true,
  canReadField: true,
  canUpdateField: true,
  isNullable: true,
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
  selectableOptions: [],
};
const tag = (docType?: string | null) => (
  <I18nProvider i18n={i18n}>
    <AttachmentDocumentTypeTag docType={docType} />
  </I18nProvider>
);

describe('AttachmentDocumentTypeTag @custom', () => {
  beforeEach(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
    jest.mocked(useAttachmentDocumentType).mockReturnValue(documentType);
  });

  it('uses the current option label and color', () => {
    render(tag('contract'));
    expect(
      screen.getByText('Contract').closest('[data-variant="soft"]'),
    ).toHaveStyle({
      // oxlint-disable-next-line twenty/no-twenty-ui-override -- Reads the rendered style without overriding it.
      '--tw-tag-background': themeCssVariables.tag.background.blue,
    });
  });

  it('shows a gray unknown label without revealing a stale value', () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, label: 'Attachment category' });
    render(tag('confidential-internal-value'));
    expect(
      screen
        .getByText('Unknown Attachment category')
        .closest('[data-variant="soft"]'),
    ).toHaveStyle({
      // oxlint-disable-next-line twenty/no-twenty-ui-override -- Reads the rendered style without overriding it.
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
    'hides null, missing, or unreadable values: $docType / $readable',
    ({ docType, readable }) => {
      jest
        .mocked(useAttachmentDocumentType)
        .mockReturnValue({ ...documentType, isReadableSelectField: readable });
      const { container } = render(tag(docType));
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('shows the label of an inactive option instead of Unknown', () => {
    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      ...documentType,
      options: [{ ...documentType.options[0], isActive: false }],
    });
    render(tag('contract'));
    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.queryByText(/Unknown/)).not.toBeInTheDocument();
  });

  it('updates the tag when metadata changes', () => {
    const { rerender } = render(tag('contract'));
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, options: [] });
    rerender(tag('contract'));
    expect(screen.queryByText('Contract')).not.toBeInTheDocument();
    expect(screen.getByText('Unknown Document type')).toBeInTheDocument();
  });
});
