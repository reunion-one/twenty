import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useCanUploadAttachmentFiles } from '@/activities/files/hooks/useCanUploadAttachmentFiles';
import { AttachmentDocumentTypeWidgetAction } from '@/page-layout/widgets/files/components/AttachmentDocumentTypeWidgetAction';

jest.mock('@/activities/files/hooks/useAttachmentDocumentType');
jest.mock('@/activities/files/hooks/useCanUploadAttachmentFiles');

describe('AttachmentDocumentTypeWidgetAction @custom', () => {
  it('renders the upstream fallback without a document type field', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ isSelectField: false } as ReturnType<
        typeof useAttachmentDocumentType
      >);
    jest
      .mocked(useCanUploadAttachmentFiles)
      .mockReturnValue({ canUploadFiles: false });
    const attachFile = jest.fn();
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentDocumentTypeWidgetAction
          targetRecord={{
            id: 'company-id',
            targetObjectNameSingular: 'company',
          }}
          fallback={<button onClick={attachFile}>Upstream attach file</button>}
        />
      </I18nProvider>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Upstream attach file' }));
    expect(attachFile).toHaveBeenCalledTimes(1);
  });
});
