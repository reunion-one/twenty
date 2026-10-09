import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';

import { AttachmentUploader } from '@/activities/files/components/AttachmentUploader';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';

const mockUploadAttachmentFiles = jest.fn();
const mockEnqueueToast = jest.fn();

jest.mock('@/activities/files/hooks/useAttachmentDocumentType', () => ({
  useAttachmentDocumentType: jest.fn(),
}));
jest.mock('@/activities/files/hooks/useUploadAttachmentFiles', () => ({
  useUploadAttachmentFiles: () => ({
    uploadAttachmentFiles: mockUploadAttachmentFiles,
  }),
}));
jest.mock('twenty-ui/components/feedback', () => ({
  ...jest.requireActual('twenty-ui/components/feedback'),
  useToast: () => ({ enqueueToast: mockEnqueueToast }),
}));

const targetableObject = {
  id: 'company-id',
  targetObjectNameSingular: 'company',
};

const setDocumentType = ({
  isSelectField,
  isNullable,
  options,
  canReadField = true,
  canUpdateField = true,
  fieldLabel = 'Document type',
}: {
  isSelectField: boolean;
  isNullable: boolean;
  options: { value: string; label: string; color: string }[];
  canReadField?: boolean;
  canUpdateField?: boolean;
  fieldLabel?: string;
}) => {
  jest.mocked(useAttachmentDocumentType).mockReturnValue({
    fieldMetadata: isSelectField
      ? { id: 'doc-type-field-id', isNullable, label: fieldLabel }
      : undefined,
    isSelectField,
    isReadableSelectField: isSelectField && canReadField,
    canReadField,
    canUpdateField,
    isNullable,
    label: canReadField ? fieldLabel : undefined,
    options,
  } as never);
};

const renderUploader = (
  children?: (props: {
    onUploadFiles: (files: File[]) => Promise<void>;
  }) => React.ReactNode,
  onUploadComplete?: () => void,
) =>
  render(
    <Provider store={createStore()}>
      <I18nProvider i18n={i18n}>
        <AttachmentUploader
          targetableObject={targetableObject}
          appearance="empty-state"
          canUploadFiles
          onUploadComplete={onUploadComplete}
        >
          {children}
        </AttachmentUploader>
      </I18nProvider>
    </Provider>,
  );

describe('AttachmentUploader @custom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadAttachmentFiles.mockResolvedValue(undefined);
  });

  it('opens the native picker directly when docType is invalid or missing', () => {
    setDocumentType({ isSelectField: false, isNullable: false, options: [] });
    const { container } = renderUploader();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const nativePicker = jest
      .spyOn(input as HTMLInputElement, 'click')
      .mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: 'Add file' }));

    expect(nativePicker).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      canReadField: true,
      canUpdateField: true,
      options: [],
      explanation: 'Add an option to Document type before uploading files.',
    },
    {
      canReadField: true,
      canUpdateField: false,
      options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
      explanation:
        'You need permission to set Document type before uploading files.',
    },
  ])(
    'disables required typed upload when setup is unavailable: $explanation',
    ({ canReadField, canUpdateField, options, explanation }) => {
      setDocumentType({
        isSelectField: true,
        isNullable: false,
        options,
        canReadField,
        canUpdateField,
      });
      renderUploader();

      const trigger = screen.getByRole('button', { name: 'Add file' });
      expect(trigger).toBeDisabled();
      expect(trigger).toHaveAttribute('title', explanation);
      expect(screen.getByText(explanation)).toBeInTheDocument();
    },
  );

  it('uses the readable docType field label in permission errors', () => {
    setDocumentType({
      isSelectField: true,
      isNullable: false,
      options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
      canUpdateField: false,
      fieldLabel: 'Attachment category',
    });
    renderUploader();

    expect(screen.getByRole('button', { name: 'Add file' })).toHaveAttribute(
      'title',
      'You need permission to set Attachment category before uploading files.',
    );
  });

  it('does not expose the docType field label when the field is unreadable', () => {
    setDocumentType({
      isSelectField: true,
      isNullable: false,
      options: [],
      canReadField: false,
      canUpdateField: false,
      fieldLabel: 'Attachment category',
    });
    renderUploader();

    expect(screen.getByRole('button', { name: 'Add file' })).toHaveAttribute(
      'title',
      'You need permission to set this field before uploading files.',
    );
    expect(screen.queryByText(/Attachment category/)).not.toBeInTheDocument();
  });

  it('keeps required dropped files pending until the user chooses a type, and cancel uploads nothing', async () => {
    setDocumentType({
      isSelectField: true,
      isNullable: false,
      options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
    });
    const user = userEvent.setup();
    const file = new File(['content'], 'contract.pdf');
    renderUploader(({ onUploadFiles }) => (
      <button onClick={() => void onUploadFiles([file])}>Drop files</button>
    ));

    await user.click(screen.getByRole('button', { name: 'Drop files' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Choose Document type',
    });
    expect(
      within(dialog).getByText('Choose Document type for 1 files.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(mockUploadAttachmentFiles).not.toHaveBeenCalled();
  });

  it('blocks duplicate batch activation while an upload is pending', async () => {
    setDocumentType({ isSelectField: true, isNullable: true, options: [] });
    let resolveUpload: () => void = () => {};
    mockUploadAttachmentFiles.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const user = userEvent.setup();
    const file = new File(['content'], 'unclassified.pdf');
    renderUploader(({ onUploadFiles }) => (
      <button onClick={() => void onUploadFiles([file])}>Drop files</button>
    ));

    await user.click(screen.getByRole('button', { name: 'Drop files' }));
    await user.click(screen.getByRole('button', { name: 'Drop files' }));

    expect(mockUploadAttachmentFiles).toHaveBeenCalledTimes(1);
    resolveUpload();
    await waitFor(() =>
      expect(mockEnqueueToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'info' }),
      ),
    );
  });

  it('uploads nullable dropped files without an explicit type when the field is unreadable', async () => {
    setDocumentType({
      isSelectField: true,
      isNullable: true,
      options: [],
      canReadField: false,
      canUpdateField: true,
    });
    const onUploadComplete = jest.fn();
    const user = userEvent.setup();
    const file = new File(['content'], 'unclassified.pdf');
    renderUploader(
      ({ onUploadFiles }) => (
        <button onClick={() => void onUploadFiles([file])}>Drop files</button>
      ),
      onUploadComplete,
    );

    await user.click(screen.getByRole('button', { name: 'Drop files' }));

    await waitFor(() =>
      expect(mockUploadAttachmentFiles).toHaveBeenCalledWith({
        files: [file],
        targetableObject,
        docType: undefined,
      }),
    );
    expect(mockEnqueueToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'info',
        children: 'Files were uploaded without a type.',
      }),
    );
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it('shows no success toast and calls no completion handler when a batch fails', async () => {
    setDocumentType({ isSelectField: true, isNullable: true, options: [] });
    mockUploadAttachmentFiles.mockRejectedValue(new Error('Upload failed'));
    const onUploadComplete = jest.fn();
    const user = userEvent.setup();
    const file = new File(['content'], 'unclassified.pdf');
    renderUploader(
      ({ onUploadFiles }) => (
        <button onClick={() => void onUploadFiles([file])}>Drop files</button>
      ),
      onUploadComplete,
    );

    await user.click(screen.getByRole('button', { name: 'Drop files' }));

    await waitFor(() => expect(mockEnqueueToast).toHaveBeenCalledTimes(1));
    expect(mockEnqueueToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
    expect(mockEnqueueToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'info' }),
    );
    expect(onUploadComplete).not.toHaveBeenCalled();
  });

  it('supports a nullable SELECT with no options and retains the null choice until files are selected', async () => {
    setDocumentType({
      isSelectField: true,
      isNullable: true,
      options: [],
      fieldLabel: 'Attachment category',
    });
    const { container } = renderUploader();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const nativePicker = jest
      .spyOn(input as HTMLInputElement, 'click')
      .mockImplementation(() => {});
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add file' }));
    await user.click(
      await screen.findByRole('menuitemradio', {
        name: 'No Attachment category',
      }),
    );

    expect(nativePicker).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('menuitemradio', {
        name: 'No Attachment category',
      }),
    ).toBeInTheDocument();
    expect(mockUploadAttachmentFiles).not.toHaveBeenCalled();
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['content'], 'unclassified.pdf')],
    });
    fireEvent.change(input as HTMLInputElement);

    await waitFor(() =>
      expect(mockUploadAttachmentFiles).toHaveBeenCalledWith({
        files: [expect.any(File)],
        targetableObject,
        docType: null,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('menuitemradio', {
          name: 'No Attachment category',
        }),
      ).not.toBeInTheDocument(),
    );
    expect(mockEnqueueToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'info',
        children: 'Files were uploaded without Attachment category.',
      }),
    );
  });

  it('keeps the type menu open until the native picker is cancelled', async () => {
    setDocumentType({
      isSelectField: true,
      isNullable: true,
      options: [{ value: 'contract', label: 'Contract', color: 'blue' }],
    });
    const { container } = renderUploader();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const nativePicker = jest
      .spyOn(input as HTMLInputElement, 'click')
      .mockImplementation(() => {
        expect(
          screen.queryByRole('menuitemradio', { name: 'Contract' }),
        ).toBeInTheDocument();
      });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add file' }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Contract' }),
    );
    expect(nativePicker).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('menuitemradio', { name: 'Contract' }),
    ).toBeInTheDocument();

    fireEvent(input as HTMLInputElement, new Event('cancel'));

    await waitFor(() =>
      expect(
        screen.queryByRole('menuitemradio', { name: 'Contract' }),
      ).not.toBeInTheDocument(),
    );
    expect(mockUploadAttachmentFiles).not.toHaveBeenCalled();
  });
});
