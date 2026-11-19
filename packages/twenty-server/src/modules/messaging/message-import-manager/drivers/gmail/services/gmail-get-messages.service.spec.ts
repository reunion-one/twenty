import { Logger } from '@nestjs/common';
import { type gmail_v1, google } from 'googleapis';
import {
  ConnectedAccountProvider,
  MessageFolderImportPolicy,
} from 'twenty-shared/types';

import { type GoogleOAuth2ClientProvider } from 'src/modules/connected-account/oauth2-client-manager/drivers/google/google-oauth2-client.provider';
import { type MessageFolderEntity } from 'src/engine/metadata-modules/message-folder/entities/message-folder.entity';
import { GmailGetMessagesService } from 'src/modules/messaging/message-import-manager/drivers/gmail/services/gmail-get-messages.service';
import { GmailMessagesImportErrorHandler } from 'src/modules/messaging/message-import-manager/drivers/gmail/services/gmail-messages-import-error-handler.service';

jest.mock('googleapis', () => ({ google: { gmail: jest.fn() } }));

describe('GmailGetMessagesService raw content @custom', () => {
  const get = jest.fn();
  const getAttachment = jest.fn();
  const getThread = jest.fn();
  const gmailClient = {
    users: {
      messages: { get, attachments: { get: getAttachment } },
      threads: { get: getThread },
    },
  };
  const provider = { getClient: jest.fn().mockResolvedValue({}) };
  const service = new GmailGetMessagesService(
    provider as unknown as GoogleOAuth2ClientProvider,
    new GmailMessagesImportErrorHandler(),
  );
  const getMessages = (
    messageFolderImportPolicy = MessageFolderImportPolicy.ALL_FOLDERS,
    messageFolders: MessageFolderEntity[] = [],
  ) =>
    service.getMessages(
      ['message-1'],
      {
        id: 'account-1',
        provider: ConnectedAccountProvider.GOOGLE,
        handle: 'sender@example.com',
        handleAliases: [],
      },
      {
        messageFolders,
        messageFolderImportPolicy,
      },
    );
  const message: gmail_v1.Schema$Message = {
    id: 'message-1',
    threadId: 'thread-1',
    internalDate: '1700000000000',
    historyId: 'history-1',
    labelIds: ['INBOX'],
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: 'sender@example.com' },
        { name: 'To', value: 'recipient@example.com' },
        { name: 'Message-ID', value: '<message@example.com>' },
      ],
      body: { attachmentId: 'body-1' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(google.gmail)
      .mockReturnValue(gmailClient as unknown as gmail_v1.Gmail);
    get.mockResolvedValue({ data: message });
    getThread.mockResolvedValue({ data: { messages: [] } });
    getAttachment.mockResolvedValue({
      data: { data: Buffer.from('Hello').toString('base64url') },
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('imports the raw content for the message', async () => {
    const [result] = await getMessages();

    expect(result.rawContent?.provider).toBe('gmail');
    expect(JSON.parse(result.rawContent!.content).source).toMatchObject({
      message_id: 'message-1',
      thread_id: 'thread-1',
    });
  });

  it('does not fetch inline bodies for excluded system labels', async () => {
    get.mockResolvedValue({ data: { ...message, labelIds: ['TRASH'] } });

    await expect(getMessages()).resolves.toEqual([]);
    expect(getAttachment).not.toHaveBeenCalled();
  });

  it('rejects when an inline body fetch fails', async () => {
    getAttachment.mockRejectedValue(new Error('Fetch failed'));

    await expect(getMessages()).rejects.toThrow('Fetch failed');
  });

  it('does not load snapshots when parsing rejects the message', async () => {
    get.mockResolvedValue({
      data: { ...message, payload: { ...message.payload, headers: [] } },
    });

    await expect(getMessages()).resolves.toEqual([]);
    expect(getAttachment).not.toHaveBeenCalled();
  });

  it('does not load snapshots for messages excluded by selected folders', async () => {
    await expect(
      getMessages(MessageFolderImportPolicy.SELECTED_FOLDERS, [
        { externalId: 'custom-folder', isSynced: true } as MessageFolderEntity,
      ]),
    ).resolves.toEqual([]);
    expect(getAttachment).not.toHaveBeenCalled();
  });

  it('loads snapshots for selected-folder thread messages and fetched siblings', async () => {
    const sibling = { ...message, id: 'message-2' };

    get.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({ data: id === 'message-2' ? sibling : message }),
    );
    getThread.mockResolvedValue({
      data: {
        messages: [
          { id: 'message-1', labelIds: ['INBOX'] },
          { id: 'message-2', labelIds: ['custom-folder'] },
        ],
      },
    });

    const messages = await getMessages(
      MessageFolderImportPolicy.SELECTED_FOLDERS,
      [{ externalId: 'custom-folder', isSynced: true } as MessageFolderEntity],
    );

    expect(messages.map((result) => result.externalId)).toEqual([
      'message-1',
      'message-2',
    ]);
    expect(
      messages.map(
        (result) => JSON.parse(result.rawContent!.content).source.message_id,
      ),
    ).toEqual(['message-1', 'message-2']);
    expect(getAttachment).toHaveBeenCalledTimes(2);
  });

  it('propagates non-HTTP snapshot encoding failures', async () => {
    getAttachment.mockResolvedValue({ data: { data: '%%%invalid' } });

    await expect(getMessages()).rejects.toThrow(
      'invalid Gmail inline body attachment encoding',
    );
  });

  it.each([404, 410])(
    'skips a vanished message on attachment status %s',
    async (status) => {
      getAttachment.mockRejectedValue({ response: { status } });

      await expect(getMessages()).resolves.toEqual([]);
    },
  );
});
