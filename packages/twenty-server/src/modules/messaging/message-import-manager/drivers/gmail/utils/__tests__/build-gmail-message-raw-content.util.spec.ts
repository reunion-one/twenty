import { type gmail_v1 } from 'googleapis';

import { GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT } from 'src/modules/messaging/message-import-manager/drivers/gmail/constants/gmail-email-snapshot-content-format.constant';
import { buildGmailMessageRawContent } from 'src/modules/messaging/message-import-manager/drivers/gmail/utils/build-gmail-message-raw-content.util';

describe('buildGmailMessageRawContent @custom', () => {
  const get = jest.fn();
  const gmailClient = {
    users: { messages: { attachments: { get } } },
  } as unknown as gmail_v1.Gmail;
  const message: gmail_v1.Schema$Message = {
    id: 'message-1',
    threadId: 'thread-1',
    payload: {
      mimeType: 'text/plain',
      body: { data: Buffer.from('Hello').toString('base64url') },
    },
  };

  beforeEach(() => jest.resetAllMocks());

  it('returns the Gmail envelope and snapshot source', async () => {
    const result = await buildGmailMessageRawContent({ gmailClient, message });

    expect(result).toMatchObject({
      provider: 'gmail',
      contentFormat: GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT,
      metadata: null,
    });
    expect(JSON.parse(result.content).source).toMatchObject({
      message_id: 'message-1',
      thread_id: 'thread-1',
    });
  });

  it('loads attachment-only inline text bytes', async () => {
    const bytes = Buffer.from('Inline café');
    get.mockResolvedValue({ data: { data: bytes.toString('base64url') } });

    const result = await buildGmailMessageRawContent({
      gmailClient,
      message: {
        ...message,
        payload: { mimeType: 'text/plain', body: { attachmentId: 'body-1' } },
      },
    });

    expect(get).toHaveBeenCalledWith({
      userId: 'me',
      messageId: 'message-1',
      id: 'body-1',
    });
    expect(
      Buffer.from(JSON.parse(result.content).mime.body_base64, 'base64'),
    ).toEqual(bytes);
  });

  it('rejects malformed attachment-only inline text data', async () => {
    get.mockResolvedValue({ data: { data: '%%%invalid' } });

    await expect(
      buildGmailMessageRawContent({
        gmailClient,
        message: {
          ...message,
          payload: { mimeType: 'text/plain', body: { attachmentId: 'body-1' } },
        },
      }),
    ).rejects.toThrow(
      'invalid Gmail inline body attachment encoding for body-1',
    );
  });

  it('does not fetch a named attachment', async () => {
    await buildGmailMessageRawContent({
      gmailClient,
      message: {
        ...message,
        payload: {
          mimeType: 'text/plain',
          filename: 'notes.txt',
          body: { attachmentId: 'file-1' },
        },
      },
    });

    expect(get).not.toHaveBeenCalled();
  });

  it.each(['id', 'threadId', 'payload'] as const)(
    'rejects a missing %s',
    async (field) => {
      await expect(
        buildGmailMessageRawContent({
          gmailClient,
          message: { ...message, [field]: undefined },
        }),
      ).rejects.toThrow();
    },
  );

  it.each([undefined, ''])(
    'rejects missing inline attachment data %s',
    async (data) => {
      get.mockResolvedValue({ data: { data } });
      await expect(
        buildGmailMessageRawContent({
          gmailClient,
          message: {
            ...message,
            payload: {
              mimeType: 'text/plain',
              body: { attachmentId: 'body-1' },
            },
          },
        }),
      ).rejects.toThrow();
    },
  );
});
