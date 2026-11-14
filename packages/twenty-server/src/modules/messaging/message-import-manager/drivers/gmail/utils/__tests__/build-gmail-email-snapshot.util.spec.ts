import { type gmail_v1 } from 'googleapis';

import { buildGmailEmailSnapshot } from 'src/modules/messaging/message-import-manager/drivers/gmail/utils/build-gmail-email-snapshot.util';

type MimeNode = {
  part_path: string;
  externalized: boolean;
  body_base64?: string;
  size_bytes?: number;
  decoding_charset?: string;
  filename?: string;
  provider_locator?: {
    provider: string;
    message_id: string;
    mime_part_path: string;
    mime_part_id: string | null;
    attachment_id: string | null;
  };
  parts?: MimeNode[];
};

type Snapshot = {
  schema: string;
  schema_version: number;
  source: { provider: string; message_id: string; thread_id: string };
  headers: { name: string; value: string }[];
  mime: MimeNode;
};

const SOURCE = { messageId: 'gmail-message', threadId: 'gmail-thread' };
const textPart = (
  text = 'Hello café',
  overrides: gmail_v1.Schema$MessagePart = {},
): gmail_v1.Schema$MessagePart => ({
  mimeType: 'text/plain',
  filename: '',
  body: { data: Buffer.from(text).toString('base64url') },
  ...overrides,
});
const snapshot = async (
  payload: gmail_v1.Schema$MessagePart,
  loadInlineBody?: (attachmentId: string) => Promise<Buffer>,
): Promise<Snapshot> =>
  JSON.parse(
    await buildGmailEmailSnapshot({ ...SOURCE, payload, loadInlineBody }),
  );

const nodesByPath = (node: MimeNode): Record<string, MimeNode> => ({
  [node.part_path]: node,
  ...Object.assign({}, ...(node.parts ?? []).map(nodesByPath)),
});
const getNode = (result: Snapshot, partPath = 'root') =>
  nodesByPath(result.mime)[partPath];
const inlineBytes = (node: MimeNode) =>
  Buffer.from(node.body_base64!, 'base64');

describe('buildGmailEmailSnapshot @custom', () => {
  it('preserves snapshot metadata and ordered root headers including duplicates', async () => {
    const headers = [
      { name: 'Received', value: 'first hop' },
      { name: 'Subject', value: 'Hello' },
      { name: 'Received', value: 'second hop' },
    ];
    const result = await snapshot(textPart('Hello', { headers }));

    expect(result).toMatchObject({
      schema: 'email-semantic-snapshot',
      schema_version: 1,
      source: {
        provider: 'gmail',
        message_id: SOURCE.messageId,
        thread_id: SOURCE.threadId,
      },
    });
    expect(result.headers).toEqual(headers);
  });

  it('stores multipart alternative plain text and HTML leaves inline', async () => {
    const plainText = 'Hello café';
    const htmlText = '<p>Hello café</p>';
    const result = await snapshot({
      mimeType: 'multipart/alternative',
      parts: [
        textPart(plainText),
        textPart(htmlText, { mimeType: 'text/html' }),
      ],
    });

    expect(Object.keys(nodesByPath(result.mime))).toEqual(['0', '1', 'root']);
    expect(getNode(result).part_path).toBe('root');
    for (const [partPath, text] of [
      ['0', plainText],
      ['1', htmlText],
    ]) {
      const node = getNode(result, partPath);

      expect(node).toMatchObject({
        part_path: partPath,
        externalized: false,
        size_bytes: Buffer.byteLength(text),
        decoding_charset: 'utf-8',
      });
      expect(inlineBytes(node).toString('utf8')).toBe(text);
    }
  });

  it('externalizes PDF attachments with their complete provider locator', async () => {
    const result = await snapshot({
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'application/pdf',
          filename: 'report.pdf',
          partId: 'pdf-part',
          body: { attachmentId: 'pdf-attachment', size: 123 },
        },
      ],
    });
    const node = getNode(result, '0');

    expect(node).toMatchObject({
      externalized: true,
      provider_locator: {
        provider: 'gmail',
        message_id: SOURCE.messageId,
        mime_part_path: '0',
        mime_part_id: 'pdf-part',
        attachment_id: 'pdf-attachment',
      },
    });
    expect(node).not.toHaveProperty('body_base64');
  });

  it('keeps attached messages opaque and omits their nested parts', async () => {
    const result = await snapshot({
      mimeType: 'message/rfc822',
      body: { attachmentId: 'attached-message' },
      parts: [textPart('nested secret', { filename: 'notes.txt' })],
    });

    expect(getNode(result).externalized).toBe(true);
    expect(Object.keys(nodesByPath(result.mime))).toEqual(['root']);
    expect(getNode(result)).not.toHaveProperty('parts');
    expect(JSON.stringify(result)).not.toContain('notes.txt');
    expect(JSON.stringify(result)).not.toContain('nested secret');
  });

  it('preserves non-UTF-8 bytes and uses the declared charset only when needed', async () => {
    const bytes = Buffer.from([0x63, 0x61, 0x66, 0xe9]);
    const headers = [
      { name: 'Content-Type', value: 'text/plain; charset=windows-1252' },
    ];
    const result = await snapshot({
      mimeType: 'multipart/alternative',
      parts: [
        textPart('', { headers, body: { data: bytes.toString('base64url') } }),
        textPart('café', { headers }),
      ],
    });

    expect(inlineBytes(getNode(result, '0'))).toEqual(bytes);
    expect(getNode(result, '0').decoding_charset).toBe('windows-1252');
    expect(inlineBytes(getNode(result, '1'))).toEqual(Buffer.from('café'));
    expect(getNode(result, '1').decoding_charset).toBe('utf-8');
  });

  it('loads attachment-backed inline text exactly once and stores its bytes inline', async () => {
    const bytes = Buffer.from('Loaded café');
    const loadInlineBody = jest.fn(async () => bytes);
    const result = await snapshot(
      textPart('', {
        headers: [{ name: 'Content-Disposition', value: 'inline' }],
        body: { attachmentId: 'inline-body' },
      }),
      loadInlineBody,
    );

    expect(loadInlineBody).toHaveBeenCalledTimes(1);
    expect(loadInlineBody).toHaveBeenCalledWith('inline-body');
    expect(getNode(result).externalized).toBe(false);
    expect(inlineBytes(getNode(result))).toEqual(bytes);
  });

  it('externalizes named text attachments without loading their bytes', async () => {
    const loadInlineBody = jest.fn();
    const result = await snapshot(
      textPart('', {
        filename: 'notes.txt',
        headers: [
          {
            name: 'Content-Disposition',
            value: 'attachment; filename="notes.txt"',
          },
        ],
        body: { attachmentId: 'notes-attachment' },
      }),
      loadInlineBody,
    );

    expect(getNode(result)).toMatchObject({
      externalized: true,
      filename: 'notes.txt',
      provider_locator: { attachment_id: 'notes-attachment' },
    });
    expect(getNode(result)).not.toHaveProperty('body_base64');
    expect(loadInlineBody).not.toHaveBeenCalled();
  });

  it('externalizes text with attachment disposition even without a filename', async () => {
    const loadInlineBody = jest.fn();
    const result = await snapshot(
      textPart('', {
        headers: [{ name: 'Content-Disposition', value: 'attachment' }],
        body: { attachmentId: 'unnamed-attachment' },
      }),
      loadInlineBody,
    );

    expect(getNode(result).externalized).toBe(true);
    expect(loadInlineBody).not.toHaveBeenCalled();
  });

  it('externalizes named text even with inline disposition', async () => {
    const loadInlineBody = jest.fn();
    const result = await snapshot(
      textPart('', {
        filename: 'notes.txt',
        headers: [{ name: 'Content-Disposition', value: 'inline' }],
        body: { attachmentId: 'named-inline' },
      }),
      loadInlineBody,
    );

    expect(getNode(result).externalized).toBe(true);
    expect(loadInlineBody).not.toHaveBeenCalled();
  });

  it('preserves attachment-backed calendar locators without loading an empty body', async () => {
    const loadInlineBody = jest.fn();
    const result = await snapshot(
      {
        mimeType: 'text/calendar',
        body: { attachmentId: 'calendar-attachment' },
      },
      loadInlineBody,
    );

    expect(getNode(result)).toMatchObject({
      externalized: true,
      provider_locator: { attachment_id: 'calendar-attachment' },
    });
    expect(getNode(result)).not.toHaveProperty('body_base64');
    expect(loadInlineBody).not.toHaveBeenCalled();
  });

  it('decodes RFC2231 filenames when Gmail supplies no filename', async () => {
    const result = await snapshot({
      mimeType: 'application/pdf',
      filename: '',
      headers: [
        {
          name: 'Content-Disposition',
          value: "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf",
        },
      ],
      body: { attachmentId: 'resume' },
    });

    expect(getNode(result).filename).toBe('résumé.pdf');
  });

  it('rejects invalid base64url body data', async () => {
    await expect(
      snapshot(textPart('', { body: { data: '%%%invalid' } })),
    ).rejects.toThrow(/invalid Gmail MIME body encoding at/);
  });

  it('rejects attachment-backed inline text when no loader is available', async () => {
    await expect(
      snapshot(textPart('', { body: { attachmentId: 'unavailable' } })),
    ).rejects.toThrow(/Gmail inline text MIME bytes unavailable at/);
  });
});
