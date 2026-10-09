import { type ImapFlow } from 'imapflow';

import { ImapMessageParserService } from 'src/modules/messaging/message-import-manager/drivers/imap/services/imap-message-parser.service';

describe('ImapMessageParserService @custom', () => {
  it('retains the original MIME bytes alongside the parsed message', async () => {
    const rawMessage = Buffer.from(
      'From: sender@example.com\r\nTo: me@example.com\r\nMessage-ID: <imap-1@example.com>\r\nSubject: Original\r\n\r\nBody',
    );
    const service = new ImapMessageParserService();
    const client = {
      getMailboxLock: jest.fn().mockResolvedValue({ release: jest.fn() }),
      mailbox: { uidValidity: BigInt(42) },
      fetchAll: jest.fn().mockResolvedValue([
        {
          uid: 1,
          source: rawMessage,
          flags: new Set<string>(),
          internalDate: new Date('2026-10-01T10:00:00.000Z'),
        },
      ]),
    } as unknown as ImapFlow;

    const result = await service.parseMessagesFromFolder([1], 'INBOX', client);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].rawMessage).toBe(rawMessage);
  });
});
