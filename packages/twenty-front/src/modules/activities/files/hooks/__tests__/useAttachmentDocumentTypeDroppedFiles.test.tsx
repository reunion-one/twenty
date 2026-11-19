import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useAttachmentDocumentTypeDroppedFiles } from '@/activities/files/hooks/useAttachmentDocumentTypeDroppedFiles';
import { useUploadAttachmentFilesWithDocumentType } from '@/activities/files/hooks/useUploadAttachmentFilesWithDocumentType';
import { useUploadAttachmentFiles } from '@/activities/files/hooks/useUploadAttachmentFiles';
import { useToast } from 'twenty-ui/components/feedback';

jest.mock('@/activities/files/hooks/useAttachmentDocumentType');
jest.mock('@/activities/files/hooks/useUploadAttachmentFilesWithDocumentType');
jest.mock('@/activities/files/hooks/useUploadAttachmentFiles', () => ({
  useUploadAttachmentFiles: jest.fn(),
}));
jest.mock('twenty-ui/components/feedback', () => ({
  ...jest.requireActual('twenty-ui/components/feedback'),
  useToast: jest.fn(),
}));
const targetableObject = {
  id: 'company-id',
  targetObjectNameSingular: 'company',
};
const documentType: ReturnType<typeof useAttachmentDocumentType> = {
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
};
const files = [new File(['file'], 'contract.pdf')];
const DropFiles = () => {
  const { uploadDroppedFiles, documentTypeDialog } =
    useAttachmentDocumentTypeDroppedFiles(targetableObject);
  return (
    <>
      <button onClick={() => void uploadDroppedFiles(files)}>Drop files</button>
      {documentTypeDialog}
    </>
  );
};

describe('useAttachmentDocumentTypeDroppedFiles @custom', () => {
  const uploadFiles = jest.fn();
  const uploadAttachmentFiles = jest.fn();
  const enqueueToast = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    i18n.loadAndActivate({ locale: 'en', messages: {} });
    uploadFiles.mockResolvedValue(undefined);
    jest.mocked(useAttachmentDocumentType).mockReturnValue(documentType);
    jest
      .mocked(useUploadAttachmentFilesWithDocumentType)
      .mockReturnValue({ uploadFiles });
    jest
      .mocked(useUploadAttachmentFiles)
      .mockReturnValue({ uploadAttachmentFiles });
    jest.mocked(useToast).mockReturnValue({
      enqueueToast,
      closeToast: jest.fn(),
      updateToast: jest.fn(),
    });
  });
  const renderDrop = () =>
    render(
      <Provider store={createStore()}>
        <I18nProvider i18n={i18n}>
          <DropFiles />
        </I18nProvider>
      </Provider>,
    );

  it('keeps required files pending and cancel uploads nothing', async () => {
    renderDrop();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Drop files' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Choose Document type for 1 file',
    });
    expect(uploadFiles).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(uploadFiles).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Drop files' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('uploads pending files only after choosing a selectable type', async () => {
    renderDrop();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Drop files' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Choose Document type' }),
    );
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Contract' }),
    );
    await waitFor(() =>
      expect(uploadFiles).toHaveBeenCalledWith(files, 'contract'),
    );
    expect(enqueueToast).not.toHaveBeenCalled();
  });

  it('blocks duplicate batch activation while an upload is pending', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, isNullable: true });
    let resolveUpload: () => void = () => {};
    uploadFiles.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    renderDrop();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Drop files' }));
    await user.click(screen.getByRole('button', { name: 'Drop files' }));
    expect(uploadFiles).toHaveBeenCalledTimes(1);
    resolveUpload();
    await waitFor(() =>
      expect(enqueueToast).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'info' }),
      ),
    );
  });

  it.each([true, false])(
    'uploads nullable drops with readable=%s and shows an info toast',
    async (canReadField) => {
      jest.mocked(useAttachmentDocumentType).mockReturnValue({
        ...documentType,
        isNullable: true,
        canReadField,
        isReadableSelectField: canReadField,
        label: canReadField ? 'Document type' : undefined,
      });
      renderDrop();
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Drop files' }));
      await waitFor(() =>
        expect(uploadFiles).toHaveBeenCalledWith(
          files,
          canReadField ? null : undefined,
        ),
      );
      expect(enqueueToast).toHaveBeenCalledWith({
        status: 'info',
        children: canReadField
          ? 'Files were uploaded without Document type.'
          : 'Files were uploaded without a type.',
      });
    },
  );

  it('shows an error without an info toast when a batch fails', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, isNullable: true });
    uploadFiles.mockRejectedValue(new Error('Upload failed'));
    renderDrop();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Drop files' }));
    await waitFor(() =>
      expect(enqueueToast).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      ),
    );
    expect(enqueueToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'info' }),
    );
  });

  it.each([
    {
      canUpdateField: false,
      options: documentType.selectableOptions,
      reason:
        'You need permission to set Document type before uploading files.',
    },
    {
      canUpdateField: true,
      options: [],
      reason: 'Add an option to Document type before uploading files.',
    },
  ])(
    'explains why a required dropped batch cannot upload: $reason',
    async ({ canUpdateField, options, reason }) => {
      jest.mocked(useAttachmentDocumentType).mockReturnValue({
        ...documentType,
        canUpdateField,
        selectableOptions: options,
      });
      renderDrop();
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Drop files' }));
      expect(enqueueToast).toHaveBeenCalledWith({
        status: 'error',
        children: reason,
      });
      expect(uploadFiles).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  it('uses plain upstream uploads without a SELECT field', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, isSelectField: false });
    renderDrop();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Drop files' }));
    expect(uploadAttachmentFiles).toHaveBeenCalledWith({
      files,
      targetableObject,
    });
    expect(uploadFiles).not.toHaveBeenCalled();
    expect(enqueueToast).not.toHaveBeenCalled();
  });
});
