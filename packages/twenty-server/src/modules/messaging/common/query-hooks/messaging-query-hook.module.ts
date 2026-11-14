import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonRecordVisibilityModule } from 'src/engine/api/common/common-record-visibility/common-record-visibility.module';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { ApplyMessageRawContentsVisibilityRestrictionsService } from 'src/modules/messaging/common/query-hooks/message-raw-content/apply-message-raw-contents-visibility-restrictions.service';
import { ApplyMessagesVisibilityRestrictionsService } from 'src/modules/messaging/common/query-hooks/message/apply-messages-visibility-restrictions.service';
import { MessageThreadTargetCreateManyPreQueryHook } from 'src/modules/messaging/common/query-hooks/message-thread-target/message-thread-target-create-many.pre-query-hook';
import { MessageThreadTargetCreateOnePreQueryHook } from 'src/modules/messaging/common/query-hooks/message-thread-target/message-thread-target-create-one.pre-query-hook';

@Module({
  imports: [
    CommonRecordVisibilityModule,
    TypeOrmModule.forFeature([MessageChannelEntity]),
  ],
  providers: [
    ApplyMessagesVisibilityRestrictionsService,
    ApplyMessageRawContentsVisibilityRestrictionsService,
    MessageThreadTargetCreateOnePreQueryHook,
    MessageThreadTargetCreateManyPreQueryHook,
  ],
})
export class MessagingQueryHookModule {}
