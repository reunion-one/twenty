import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';

import { AttachmentDropdown } from '@/activities/files/components/AttachmentDropdown';
import { useAttachmentDocumentType } from '@/activities/files/hooks/useAttachmentDocumentType';

const mockUpdateOneRecord = jest.fn();
const mockEnqueueToast = jest.fn();
const mockUserIcon = () => <svg data-testid="doc-type-user-icon" />;
const mockBuildingIcon = () => <svg data-testid="doc-type-building-icon" />;
const mockGetIcon = jest.fn();

jest.mock('@/activities/files/hooks/useAttachmentDocumentType', () => ({
  useAttachmentDocumentType: jest.fn(),
}));
jest.mock('twenty-ui/icon', () => ({
  ...jest.requireActual('twenty-ui/icon'),
  useIcons: () => ({ getIcon: mockGetIcon }),
}));
jest.mock('@/object-record/hooks/useUpdateOneRecord', () => ({
  useUpdateOneRecord: () => ({ updateOneRecord: mockUpdateOneRecord }),
}));
jest.mock('twenty-ui/components/feedback', () => ({
  ...jest.requireActual('twenty-ui/components/feedback'),
  useToast: () => ({ enqueueToast: mockEnqueueToast }),
}));

const getAttachmentDropdown = (store = createStore()) => (
  <Provider store={store}>
    <I18nProvider i18n={i18n}>
      <AttachmentDropdown
        attachmentId="attachment-id"
        onDownload={jest.fn()}
        onDelete={jest.fn()}
        onRename={jest.fn()}
        hasDownloadPermission
        docType="contract"
      />
    </I18nProvider>
  </Provider>
);

const renderAttachmentDropdown = () => render(getAttachmentDropdown());

const openDocumentTypeSubmenu = async (
  user: ReturnType<typeof userEvent.setup>,
) => {
  await user.click(screen.getByRole('button', { name: 'More options' }));
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
  );
  await user.keyboard('{ArrowDown}');
  const download = await screen.findByRole('menuitem', { name: 'Download' });
  await waitFor(() => expect(download).toHaveFocus());
  await user.keyboard('{ArrowDown}');
  const documentType = await screen.findByRole('menuitem', {
    name: 'Document type · Contract',
  });
  await waitFor(() => expect(documentType).toHaveFocus());
  await user.keyboard('{ArrowRight}');
  await screen.findByRole('menu', { name: 'Document type' });
};

describe('AttachmentDropdown document type actions @custom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIcon.mockImplementation((iconName: string | null | undefined) => {
      if (iconName === 'IconUser') {
        return mockUserIcon;
      }

      if (iconName === 'IconBuildingSkyscraper') {
        return mockBuildingIcon;
      }

      return mockUserIcon;
    });
    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      fieldMetadata: {
        id: 'doc-type-field-id',
        isNullable: true,
      },
      isSelectField: true,
      isReadableSelectField: true,
      canReadField: true,
      canUpdateField: true,
      isNullable: true,
      icon: 'IconUser',
      label: 'Document type',
      options: [
        { value: 'contract', label: 'Contract', color: 'blue' },
        { value: 'invoice', label: 'Invoice', color: 'red' },
      ],
    } as never);
  });

  it('shows the searchable type submenu and updates only docType', async () => {
    mockUpdateOneRecord.mockResolvedValue({ id: 'attachment-id' });
    const user = userEvent.setup();
    renderAttachmentDropdown();
    await openDocumentTypeSubmenu(user);

    const contractOption = await screen.findByRole('menuitemradio', {
      name: 'Contract',
    });
    expect(contractOption).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('searchbox', { name: 'Search' }),
    ).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');

    await waitFor(() =>
      expect(mockUpdateOneRecord).toHaveBeenCalledWith({
        objectNameSingular: 'attachment',
        idToUpdate: 'attachment-id',
        updateOneRecordInput: { docType: 'invoice' },
      }),
    );
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
  });

  it('reports update failures and retains existing attachment actions', async () => {
    let rejectUpdate: (error: Error) => void = () => {};
    mockUpdateOneRecord.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectUpdate = reject;
        }),
    );
    const user = userEvent.setup();
    renderAttachmentDropdown();
    await openDocumentTypeSubmenu(user);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    const documentType = await screen.findByRole('menuitem', {
      name: /Document type/,
    });
    expect(documentType).toHaveAttribute('aria-disabled', 'true');
    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);

    await act(async () => {
      rejectUpdate(new Error('Update rejected'));
    });

    await waitFor(() => expect(mockEnqueueToast).toHaveBeenCalledTimes(1));
    expect(mockEnqueueToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
    await waitFor(() =>
      expect(documentType).not.toHaveAttribute('aria-disabled', 'true'),
    );
    expect(
      screen.getByRole('menuitem', { name: 'Download' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Rename' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Delete' }),
    ).toBeInTheDocument();
  });

  it('uses the configured docType icon and updates it with metadata', async () => {
    const user = userEvent.setup();
    const store = createStore();
    const { rerender } = render(getAttachmentDropdown(store));

    await user.click(screen.getByRole('button', { name: 'More options' }));
    const documentTypeMenuItem = await screen.findByRole('menuitem', {
      name: /Document type/,
    });
    expect(screen.getByTestId('doc-type-user-icon')).toBeInTheDocument();

    jest.mocked(useAttachmentDocumentType).mockReturnValue({
      fieldMetadata: {
        id: 'doc-type-field-id',
        isNullable: true,
      },
      isSelectField: true,
      isReadableSelectField: true,
      canReadField: true,
      canUpdateField: true,
      isNullable: true,
      icon: 'IconBuildingSkyscraper',
      label: 'Attachment category',
      options: [
        { value: 'contract', label: 'Contract', color: 'blue' },
        { value: 'invoice', label: 'Invoice', color: 'red' },
      ],
    } as never);

    rerender(getAttachmentDropdown(store));

    expect(
      await screen.findByRole('menuitem', {
        name: 'Attachment category · Contract',
      }),
    ).toBeInTheDocument();
    expect(documentTypeMenuItem).toHaveAccessibleName(
      'Attachment category · Contract',
    );
    expect(screen.queryByTestId('doc-type-user-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('doc-type-building-icon')).toBeInTheDocument();
    expect(mockGetIcon).toHaveBeenLastCalledWith('IconBuildingSkyscraper');
  });
});
