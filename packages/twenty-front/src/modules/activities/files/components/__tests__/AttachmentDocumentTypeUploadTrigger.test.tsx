import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { AttachmentDocumentTypeUploadTrigger } from '@/activities/files/components/AttachmentDocumentTypeUploadTrigger';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';
import { useUploadAttachmentFilesWithDocumentType } from '@/activities/files/hooks/useUploadAttachmentFilesWithDocumentType';
import { useUploadAttachmentFiles } from '@/activities/files/hooks/useUploadAttachmentFiles';
import { useToast } from 'twenty-ui/components/feedback';
import { Button } from 'twenty-ui/primitives/input';

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

describe('AttachmentDocumentTypeUploadTrigger @custom', () => {
  const uploadFiles = jest.fn();
  const uploadAttachmentFiles = jest.fn();
  const enqueueToast = jest.fn();
  const onUploadComplete = jest.fn();
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
  const renderTrigger = () =>
    render(
      <Provider store={createStore()}>
        <I18nProvider i18n={i18n}>
          <AttachmentDocumentTypeUploadTrigger
            targetableObject={targetableObject}
            onUploadComplete={onUploadComplete}
          >
            {({ openFilePicker, disabled, describedById }) => (
              <Button
                onClick={openFilePicker}
                disabled={disabled}
                aria-describedby={describedById}
              >
                Add file
              </Button>
            )}
          </AttachmentDocumentTypeUploadTrigger>
        </I18nProvider>
      </Provider>,
    );

  it('renders the upstream trigger without a docType field', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, isSelectField: false });
    const { container } = renderTrigger();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error('Missing upstream file input');
    }
    const click = jest.spyOn(input, 'click').mockImplementation(() => {});
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Add file' }));
    expect(click).toHaveBeenCalledTimes(1);
    const file = new File(['file'], 'file.pdf');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(uploadAttachmentFiles).toHaveBeenCalledWith({
        files: [file],
        targetableObject,
      }),
    );
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it.each([
    {
      options: [],
      canUpdateField: true,
      label: 'Document type',
      reason: 'Add an option to Document type before uploading files.',
    },
    {
      options: documentType.selectableOptions,
      canUpdateField: false,
      label: 'Document type',
      reason:
        'You need permission to set Document type before uploading files.',
    },
    {
      options: documentType.selectableOptions,
      canUpdateField: false,
      label: 'Attachment category',
      reason:
        'You need permission to set Attachment category before uploading files.',
    },
  ])(
    'disables required upload with an accessible reason: $reason',
    ({ options, canUpdateField, label, reason }) => {
      jest.mocked(useAttachmentDocumentType).mockReturnValue({
        ...documentType,
        isNullable: false,
        selectableOptions: options,
        canUpdateField,
        label,
      });
      renderTrigger();
      expect(screen.getByRole('button', { name: 'Add file' })).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Add file' }),
      ).toHaveAccessibleDescription(reason);
    },
  );

  it('does not expose unreadable field labels', () => {
    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      ...documentType,
      isNullable: false,
      canReadField: false,
      isReadableSelectField: false,
      label: undefined,
    });
    renderTrigger();
    expect(
      screen.getByRole('button', { name: 'Add file' }),
    ).toHaveAccessibleDescription(
      'You need permission to set this field before uploading files.',
    );
    expect(screen.queryByText(/Document type/)).not.toBeInTheDocument();
  });

  it('opens the native picker directly for a nullable field without update permission', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, canUpdateField: false });
    renderTrigger();
    const input = screen.getByLabelText<HTMLInputElement>('Files');
    const click = jest.spyOn(input, 'click').mockImplementation(() => {});
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Add file' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Add file' }),
    ).toHaveAccessibleDescription(
      'Files will be uploaded without Document type because you cannot set it.',
    );
    const file = new File(['file'], 'file.pdf');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(uploadFiles).toHaveBeenCalledWith([file], undefined),
    );
    expect(enqueueToast).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'info' }),
    );
  });

  it('retains a nullable clear choice until files are selected', async () => {
    jest
      .mocked(useAttachmentDocumentType)
      .mockReturnValue({ ...documentType, options: [], selectableOptions: [] });
    renderTrigger();
    const user = userEvent.setup();
    const input = screen.getByLabelText<HTMLInputElement>('Files');
    const click = jest.spyOn(input, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Add file' }));
    expect(click).not.toHaveBeenCalled();
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'No Document type' }),
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('menuitemradio', { name: 'No Document type' }),
    ).toBeInTheDocument();
    const file = new File(['file'], 'file.pdf');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith([file], null));
    expect(enqueueToast).toHaveBeenCalledWith({
      status: 'info',
      children: 'Files were uploaded without Document type.',
    });
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps the menu open until the native picker is cancelled', async () => {
    renderTrigger();
    const user = userEvent.setup();
    const input = screen.getByLabelText<HTMLInputElement>('Files');
    const showPicker = jest.fn();
    Object.defineProperty(input, 'showPicker', {
      configurable: true,
      value: showPicker,
    });
    await user.click(screen.getByRole('button', { name: 'Add file' }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Contract' }),
    );
    expect(showPicker).toHaveBeenCalledTimes(1);
    await user.click(document.body);
    expect(
      screen.getByRole('menuitemradio', { name: 'Contract' }),
    ).toBeInTheDocument();
    fireEvent(input, new Event('cancel'));
    await waitFor(() =>
      expect(
        screen.queryByRole('menuitemradio', { name: 'Contract' }),
      ).not.toBeInTheDocument(),
    );
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('falls back from showPicker and reports failure without completion or info toast', async () => {
    uploadFiles.mockRejectedValue(new Error('Upload failed'));
    renderTrigger();
    const user = userEvent.setup();
    const input = screen.getByLabelText<HTMLInputElement>('Files');
    Object.defineProperty(input, 'showPicker', {
      configurable: true,
      value: () => {
        throw new Error('Unsupported');
      },
    });
    const click = jest.spyOn(input, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Add file' }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Contract' }),
    );
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.change(input, {
      target: { files: [new File(['file'], 'file.pdf')] },
    });
    await waitFor(() =>
      expect(enqueueToast).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      ),
    );
    expect(enqueueToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'info' }),
    );
    expect(onUploadComplete).not.toHaveBeenCalled();
  });
});
