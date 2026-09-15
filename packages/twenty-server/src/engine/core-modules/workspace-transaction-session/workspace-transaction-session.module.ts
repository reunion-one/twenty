import { Module } from '@nestjs/common';

import { TwentyOrmModule } from 'src/engine/twenty-orm/twenty-orm.module';
import { WorkspaceTransactionContextMiddleware } from 'src/engine/core-modules/workspace-transaction-session/middleware/workspace-transaction-context.middleware';
import { WorkspaceTransactionSessionManager } from 'src/engine/core-modules/workspace-transaction-session/services/workspace-transaction-session-manager.service';

@Module({
  imports: [TwentyOrmModule],
  providers: [
    WorkspaceTransactionSessionManager,
    WorkspaceTransactionContextMiddleware,
  ],
  exports: [
    WorkspaceTransactionSessionManager,
    WorkspaceTransactionContextMiddleware,
  ],
})
export class WorkspaceTransactionSessionModule {}
