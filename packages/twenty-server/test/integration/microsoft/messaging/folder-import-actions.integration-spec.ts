import { randomUUID } from 'node:crypto';

import {
  ConnectedAccountProvider,
  MessageFolderPendingSyncAction,
} from 'twenty-shared/types';

import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { SEED_APPLE_WORKSPACE_ID } from 'src/engine/workspace-manager/dev-seeder/core/constants/seeder-workspaces.constant';
import { setupMicrosoftMock } from 'test/integration/microsoft/mocks/setup-microsoft-mock.util';
import { connectMessagingAccount } from 'test/integration/utils/connect-messaging-account.util';
import { findImportedMessageSubjects } from 'test/integration/utils/find-imported-records.util';
import {
  type MessageFolderDto,
  queryMessageFolders,
} from 'test/integration/utils/query-messaging.util';
import {
  FOLDER_ACTION_NAMES,
  MESSAGE_COUNT_ABOVE_V8_SPREAD_ARGUMENT_LIMIT,
  runFolderActions,
  runFolderActionsWithoutPendingActions,
} from 'test/integration/utils/run-folder-actions.util';
import { runMessageChannelSync } from 'test/integration/utils/run-message-channel-sync.util';

const HANDLE = 'microsoft-folder-actions@apple.dev';
const DELETED_FOLDER_NAME = 'Inbox';
const IMPORTED_SUBJECT = `Microsoft inbox message ${randomUUID()}`;

const INBOX_MESSAGE = {
  id: 'microsoft-folder-actions-message',
  subject: IMPORTED_SUBJECT,
  body: { contentType: 'text', content: 'Microsoft inbox body' },
  receivedDateTime: '2026-08-13T00:00:00.000Z',
  internetMessageId: '<microsoft-folder-actions@example.com>',
  conversationId: 'microsoft-folder-actions-conversation',
  parentFolderId: 'inbox',
  isDraft: false,
  from: { emailAddress: { address: 'sender@external.test' } },
  toRecipients: [{ emailAddress: { address: HANDLE } }],
};

describe('Microsoft folder actions (integration)', () => {
  setupMicrosoftMock({ handle: HANDLE, messages: [INBOX_MESSAGE] });

  let channel: Awaited<ReturnType<typeof connectMessagingAccount>>;
  let messageExternalIdsToImport: string[];
  let messageExternalIdsWithoutPendingActions: string[];
  let folders: MessageFolderDto[];
  let subjectsBeforeFolderDeletion: string[];
  let subjectsAfterFolderDeletion: string[];
  let importedRawProviderData: unknown;

  beforeAll(async () => {
    channel = await connectMessagingAccount({
      provider: ConnectedAccountProvider.MICROSOFT,
      handle: HANDLE,
    });

    await runMessageChannelSync(channel.channelId);

    subjectsBeforeFolderDeletion = await findImportedMessageSubjects([
      IMPORTED_SUBJECT,
    ]);
    const workspaceSchema = getWorkspaceSchemaName(SEED_APPLE_WORKSPACE_ID);
    const [importedMessage] = await global.testDataSource.query(
      `SELECT "rawProviderData"
         FROM "${workspaceSchema}"."message"
        WHERE subject = $1`,
      [IMPORTED_SUBJECT],
    );
    importedRawProviderData = importedMessage.rawProviderData;

    messageExternalIdsToImport = await runFolderActions({
      messageChannelId: channel.channelId,
      folderNameToDelete: DELETED_FOLDER_NAME,
    });

    subjectsAfterFolderDeletion = await findImportedMessageSubjects([
      IMPORTED_SUBJECT,
    ]);
    folders = await queryMessageFolders(channel.channelId);

    messageExternalIdsWithoutPendingActions =
      await runFolderActionsWithoutPendingActions(channel.channelId);
  }, 180000);

  afterAll(async () => {
    jest.restoreAllMocks();
    await channel?.cleanup().catch(() => undefined);
  });

  it('stores the original Microsoft Graph message payload @custom', () => {
    expect(importedRawProviderData).toEqual(INBOX_MESSAGE);
  });

  it('imports every message id of a folder larger than the spread-argument limit, deduplicated', () => {
    expect(messageExternalIdsToImport).toHaveLength(
      MESSAGE_COUNT_ABOVE_V8_SPREAD_ARGUMENT_LIMIT,
    );
  });

  it('clears the pending action it processed, keeps the one it failed on, and drops the deleted folder', () => {
    expect(
      Object.fromEntries(
        folders.map((folder) => [folder.name, folder.pendingSyncAction]),
      ),
    ).toEqual({
      'Sent Items': MessageFolderPendingSyncAction.NONE,
      [FOLDER_ACTION_NAMES.imported]: MessageFolderPendingSyncAction.NONE,
      [FOLDER_ACTION_NAMES.failing]:
        MessageFolderPendingSyncAction.FOLDER_IMPORT,
      [FOLDER_ACTION_NAMES.untouched]: MessageFolderPendingSyncAction.NONE,
    });
  });

  it('deletes the messages of the folder marked for deletion', () => {
    expect(subjectsBeforeFolderDeletion).toEqual([IMPORTED_SUBJECT]);
    expect(subjectsAfterFolderDeletion).toEqual([]);
  });

  it('imports nothing when no folder carries a pending action', () => {
    expect(messageExternalIdsWithoutPendingActions).toEqual([]);
  });
});
