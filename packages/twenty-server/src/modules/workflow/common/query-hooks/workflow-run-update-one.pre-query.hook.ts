import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type UpdateOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkflowCustomFieldUpdateValidationService } from 'src/modules/workflow/common/query-hooks/workflow-custom-field-update-validation.service';
import { type WorkflowRunWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';

@WorkspaceQueryHook(`workflowRun.updateOne`)
export class WorkflowRunUpdateOnePreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly workflowCustomFieldUpdateValidationService: WorkflowCustomFieldUpdateValidationService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    objectName: string,
    payload: UpdateOneResolverArgs<WorkflowRunWorkspaceEntity>,
  ): Promise<UpdateOneResolverArgs<WorkflowRunWorkspaceEntity>> {
    await this.workflowCustomFieldUpdateValidationService.validate({
      authContext,
      objectName,
      data: payload.data,
      allowedFields: ['name'],
    });

    return payload;
  }
}
