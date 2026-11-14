import { isString } from '@sniptt/guards';
import { type gmail_v1 } from 'googleapis';
import libmime from 'libmime';

export const buildGmailEmailSnapshot = async ({
  payload,
  messageId,
  threadId,
  loadInlineBody,
}: {
  payload: gmail_v1.Schema$MessagePart;
  messageId: string;
  threadId: string;
  loadInlineBody?: (attachmentId: string) => Promise<Buffer>;
}): Promise<string> => {
  const buildPart = async (
    part: gmail_v1.Schema$MessagePart,
    partPath: string,
  ): Promise<Record<string, unknown>> => {
    const headers = (part.headers ?? []).flatMap(({ name, value }) =>
      isString(name) && isString(value) ? [{ name, value }] : [],
    );
    const headerMap = new Map<string, string>();

    for (const { name, value } of headers) {
      if (!headerMap.has(name.toLowerCase())) {
        headerMap.set(name.toLowerCase(), value);
      }
    }

    const contentTypeHeader = libmime.parseHeaderValue(
      headerMap.get('content-type') ?? '',
    );
    const dispositionHeader = libmime.parseHeaderValue(
      headerMap.get('content-disposition') ?? '',
    );
    const contentType = (
      part.mimeType || 'application/octet-stream'
    ).toLowerCase();
    const charset = contentTypeHeader.params.charset?.toLowerCase() ?? null;
    const disposition = headerMap.has('content-disposition')
      ? dispositionHeader.value.toLowerCase()
      : null;
    const filename =
      part.filename ||
      ((
        dispositionHeader.params.filename ?? contentTypeHeader.params.name
      )?.trim() ??
        null);
    const body = part.body ?? {};
    const children = part.parts ?? [];
    const isInlineText =
      contentType.startsWith('text/plain') ||
      contentType.startsWith('text/html');
    // Deliberately differs from ai-agents to keep the attachment locator.
    const isUnloadedTextAttachment =
      !children.length &&
      contentType.startsWith('text/') &&
      !isInlineText &&
      !body.data &&
      Boolean(body.attachmentId);
    const externalized =
      disposition === 'attachment' ||
      Boolean(filename) ||
      contentType === 'message/rfc822' ||
      isUnloadedTextAttachment ||
      (!children.length &&
        !contentType.startsWith('text/') &&
        !contentType.startsWith('multipart/'));
    const node = {
      part_path: partPath,
      mime_part_id: part.partId ?? null,
      content_type: contentType,
      charset,
      content_disposition: disposition,
      content_id: headerMap.get('content-id') ?? null,
      filename,
      transfer_encoding: headerMap.get('content-transfer-encoding') ?? null,
      headers,
      externalized,
    };

    if (externalized) {
      return {
        ...node,
        size_bytes: body.size ?? null,
        provider_locator: {
          provider: 'gmail',
          message_id: messageId,
          mime_part_path: partPath,
          mime_part_id: part.partId ?? null,
          attachment_id: body.attachmentId ?? null,
        },
      };
    }

    if (children.length) {
      return {
        ...node,
        parts: await Promise.all(
          children.map((child, index) =>
            buildPart(
              child,
              partPath === 'root' ? String(index) : `${partPath}.${index}`,
            ),
          ),
        ),
      };
    }

    let bytes: Buffer = Buffer.alloc(0);

    if (!body.data && body.attachmentId && isInlineText) {
      if (!loadInlineBody) {
        throw new Error(
          `Gmail inline text MIME bytes unavailable at ${partPath}`,
        );
      }
      bytes = await loadInlineBody(body.attachmentId);
      if (!Buffer.isBuffer(bytes)) {
        throw new Error(
          `invalid resolved Gmail text MIME bytes at ${partPath}`,
        );
      }
    } else if (body.data) {
      const padded = body.data + '='.repeat((4 - (body.data.length % 4)) % 4);

      if (
        !/^(?:[A-Za-z0-9+/_-]{4})*(?:[A-Za-z0-9+/_-]{2}==|[A-Za-z0-9+/_-]{3}=)?$/.test(
          padded,
        )
      ) {
        throw new Error(`invalid Gmail MIME body encoding at ${partPath}`);
      }
      bytes = Buffer.from(padded, 'base64');
    }

    let decodingCharset = 'utf-8';

    if (contentType.startsWith('text/')) {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        decodingCharset = charset || 'utf-8';
      }
    }

    return {
      ...node,
      size_bytes: bytes.length,
      body_base64: bytes.toString('base64'),
      ...(contentType.startsWith('text/')
        ? { decoding_charset: decodingCharset }
        : {}),
    };
  };
  const mime = await buildPart(payload, 'root');

  return JSON.stringify({
    schema: 'email-semantic-snapshot',
    schema_version: 1,
    source: { provider: 'gmail', message_id: messageId, thread_id: threadId },
    headers: mime.headers,
    mime,
  });
};
