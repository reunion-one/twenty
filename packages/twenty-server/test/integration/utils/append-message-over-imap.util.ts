import { ImapFlow } from 'imapflow';

// Dovecot only stores and serves mailboxes, so mail is placed with APPEND
// rather than delivered over SMTP. This also removes the delivery race an SMTP
// hand-off introduces between sending and the message becoming fetchable.
export const appendMessageOverImap = async ({
  host,
  port,
  username,
  password,
  folder,
  from,
  to,
  subject,
}: {
  host: string;
  port: number;
  username: string;
  password: string;
  folder: string;
  from: string;
  to: string;
  subject: string;
}): Promise<Buffer> => {
  const client = new ImapFlow({
    host,
    port,
    secure: false,
    auth: { user: username, pass: password },
    logger: false,
  });

  await client.connect();

  try {
    const message = Buffer.from(
      [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        `body of ${subject}`,
        '',
      ].join('\r\n'),
    );

    await client.append(folder, message);

    return message;
  } finally {
    await client.logout();
  }
};
