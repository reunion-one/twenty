import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { ApiPath } from 'twenty-shared/types';

import { type AuthenticatedRequest } from 'src/engine/api/rest/types/authenticated-request';
import { CustomPermissionGuard } from 'src/engine/guards/custom-permission.guard';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { WorkspaceTransactionSessionRestApiExceptionFilter } from 'src/engine/core-modules/workspace-transaction-session/filters/workspace-transaction-session-rest-api-exception.filter';
import { WorkspaceTransactionSessionManager } from 'src/engine/core-modules/workspace-transaction-session/services/workspace-transaction-session-manager.service';

@Controller(`${ApiPath.Rest}/transaction-sessions`)
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard, CustomPermissionGuard)
@UseFilters(WorkspaceTransactionSessionRestApiExceptionFilter)
export class WorkspaceTransactionSessionController {
  constructor(
    private readonly workspaceTransactionSessionManager: WorkspaceTransactionSessionManager,
  ) {}

  @Post()
  begin(@Req() request: AuthenticatedRequest) {
    return this.workspaceTransactionSessionManager.begin(
      getWorkspaceAuthContext(),
      request.workspaceMetadataVersion,
    );
  }

  @Get(':transactionId')
  getStatus(@Param('transactionId') transactionId: string) {
    return this.workspaceTransactionSessionManager.getStatus(
      transactionId,
      getWorkspaceAuthContext(),
    );
  }

  @Post(':transactionId/commit')
  commit(
    @Param('transactionId') transactionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workspaceTransactionSessionManager.commit(
      transactionId,
      getWorkspaceAuthContext(),
      request.workspaceMetadataVersion,
    );
  }

  @Post(':transactionId/rollback')
  rollback(@Param('transactionId') transactionId: string) {
    return this.workspaceTransactionSessionManager.rollback(
      transactionId,
      getWorkspaceAuthContext(),
    );
  }
}
