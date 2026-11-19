import { Test } from '@nestjs/testing';

import { type SendMailOptions } from 'nodemailer';
import {
  DEFAULT_WORKSPACE_LOGO,
  renderEmail,
  TwoFactorAuthenticationRemovedEmail,
} from 'twenty-emails';

import { DomainServerConfigService } from 'src/engine/core-modules/domain/domain-server-config/services/domain-server-config.service';
import { EMAIL_SEND_RETRY_BACKOFF } from 'src/engine/core-modules/email/constants/email-send-retry-backoff.constant';
import { EmailSenderJob } from 'src/engine/core-modules/email/email-sender.job';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { getQueueToken } from 'src/engine/core-modules/message-queue/utils/get-queue-token.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

describe('EmailService @custom', () => {
  let emailService: EmailService;
  const messageQueueService = { add: jest.fn() };
  const configuration: Record<string, string | boolean> = {
    FRONTEND_URL: 'https://example.com',
    SERVER_URL: 'https://server.example.com',
    IS_MULTIWORKSPACE_ENABLED: true,
    DEFAULT_SUBDOMAIN: 'app',
  };
  const queueOptions = {
    retryLimit: 3,
    backoff: EMAIL_SEND_RETRY_BACKOFF,
    isSystemJob: true,
  };

  beforeAll(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        DomainServerConfigService,
        {
          provide: TwentyConfigService,
          useValue: { get: (key: string) => configuration[key] },
        },
        {
          provide: getQueueToken(MessageQueue.emailQueue),
          useValue: messageQueueService,
        },
      ],
    }).compile();

    emailService = module.get(EmailService);
  });

  it('queues a rendered two-factor email with the public logo on the server base URL', async () => {
    const html = await renderEmail(
      TwoFactorAuthenticationRemovedEmail({
        workspaceDisplayName: 'Acme',
        locale: 'en',
      }),
    );

    expect(html).toContain(`src="${DEFAULT_WORKSPACE_LOGO}"`);
    expect(html).toContain('alt="Web3 CRM logo"');

    await emailService.send({ to: 'member@example.com', html });

    expect(messageQueueService.add).toHaveBeenCalledWith(
      EmailSenderJob.name,
      {
        to: 'member@example.com',
        html: expect.stringContaining(
          `src="https://app.example.com${DEFAULT_WORKSPACE_LOGO}"`,
        ),
      },
      queueOptions,
    );
  });

  it('resolves every shared logo without changing workspace logos', async () => {
    await emailService.send({
      html: `<img src="${DEFAULT_WORKSPACE_LOGO}"><img src="https://workspace.example.com/logo.png"><img src="${DEFAULT_WORKSPACE_LOGO}">`,
    });

    expect(messageQueueService.add).toHaveBeenCalledWith(
      EmailSenderJob.name,
      {
        html: `<img src="https://app.example.com${DEFAULT_WORKSPACE_LOGO}"><img src="https://workspace.example.com/logo.png"><img src="https://app.example.com${DEFAULT_WORKSPACE_LOGO}">`,
      },
      queueOptions,
    );
  });

  it.each<SendMailOptions['html']>([
    '<p>No shared logo</p>',
    undefined,
    Buffer.from('<p>Buffered email</p>'),
  ])('preserves HTML without a shared logo: %p', async (html) => {
    const sendMailOptions = { to: 'member@example.com', html };

    await emailService.send(sendMailOptions);

    expect(messageQueueService.add).toHaveBeenCalledWith(
      EmailSenderJob.name,
      sendMailOptions,
      queueOptions,
    );
  });
});
