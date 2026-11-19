import { type DynamicModule, Global } from '@nestjs/common';

import { DomainServerConfigModule } from 'src/engine/core-modules/domain/domain-server-config/domain-server-config.module';
import { EmailDriverFactory } from 'src/engine/core-modules/email/email-driver.factory';
import { EmailSenderService } from 'src/engine/core-modules/email/email-sender.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';

@Global()
export class EmailModule {
  static forRoot(): DynamicModule {
    return {
      module: EmailModule,
      imports: [TwentyConfigModule, DomainServerConfigModule],
      providers: [EmailDriverFactory, EmailSenderService, EmailService],
      exports: [EmailSenderService, EmailService],
    };
  }
}
