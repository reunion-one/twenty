import { Injectable } from '@nestjs/common';

import { type SendMailOptions } from 'nodemailer';
import { DEFAULT_WORKSPACE_LOGO } from 'twenty-emails';

import { DomainServerConfigService } from 'src/engine/core-modules/domain/domain-server-config/services/domain-server-config.service';
import { EMAIL_SEND_RETRY_BACKOFF } from 'src/engine/core-modules/email/constants/email-send-retry-backoff.constant';
import { EmailSenderJob } from 'src/engine/core-modules/email/email-sender.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

@Injectable()
export class EmailService {
  constructor(
    @InjectMessageQueue(MessageQueue.emailQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly domainServerConfigService: DomainServerConfigService,
  ) {}

  async send(sendMailOptions: SendMailOptions): Promise<void> {
    if (typeof sendMailOptions.html === 'string') {
      // Email clients need an absolute URL for the shared public logo.
      sendMailOptions = {
        ...sendMailOptions,
        html: sendMailOptions.html
          .split(`"${DEFAULT_WORKSPACE_LOGO}"`)
          .join(
            `"${new URL(DEFAULT_WORKSPACE_LOGO, this.domainServerConfigService.getBaseUrl())}"`,
          ),
      };
    }

    await this.messageQueueService.add<SendMailOptions>(
      EmailSenderJob.name,
      sendMailOptions,
      { retryLimit: 3, backoff: EMAIL_SEND_RETRY_BACKOFF, isSystemJob: true },
    );
  }
}
