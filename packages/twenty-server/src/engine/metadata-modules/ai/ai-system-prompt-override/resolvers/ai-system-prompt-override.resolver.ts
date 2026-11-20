import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AccessPolicyGuard } from 'src/engine/guards/access-policy.guard';
import { AiSystemPromptOverrideSectionDTO } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/dtos/ai-system-prompt-override-section.dto';
import { UpsertAiSystemPromptOverrideInput } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/dtos/upsert-ai-system-prompt-override.input';
import { AiSystemPromptOverrideService } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/services/ai-system-prompt-override.service';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/permissions/utils/permissions-graphql-api-exception.filter';

@MetadataResolver(() => AiSystemPromptOverrideSectionDTO)
@UsePipes(ResolverValidationPipe)
@UseFilters(
  PreventNestToAutoLogGraphqlErrorsFilter,
  PermissionsGraphqlApiExceptionFilter,
  AuthGraphqlApiExceptionFilter,
)
export class AiSystemPromptOverrideResolver {
  constructor(
    private readonly aiSystemPromptOverrideService: AiSystemPromptOverrideService,
  ) {}

  @Query(() => [AiSystemPromptOverrideSectionDTO])
  @UseGuards(
    AccessPolicyGuard({
      authPrincipals: {
        userSession: {
          standard: true,
          impersonated: true,
          playground: true,
          workspaceAgnostic: false,
        },
        apiKey: false,
        oauthClient: false,
        application: false,
      },
      requiredPermissionFlags: [PermissionFlagType.AI],
    }),
  )
  async aiSystemPromptOverrideSections(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    return this.aiSystemPromptOverrideService.listSettingsSections(
      workspace.id,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(
    AccessPolicyGuard({
      authPrincipals: {
        userSession: {
          standard: true,
          impersonated: true,
          playground: true,
          workspaceAgnostic: false,
        },
        apiKey: false,
        oauthClient: false,
        application: false,
      },
      requiredPermissionFlags: [PermissionFlagType.AI_SETTINGS],
    }),
  )
  async upsertAiSystemPromptOverride(
    @Args('input') input: UpsertAiSystemPromptOverrideInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    await this.aiSystemPromptOverrideService.upsert(
      workspace.id,
      input.sectionKey,
      input.content,
    );

    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(
    AccessPolicyGuard({
      authPrincipals: {
        userSession: {
          standard: true,
          impersonated: true,
          playground: true,
          workspaceAgnostic: false,
        },
        apiKey: false,
        oauthClient: false,
        application: false,
      },
      requiredPermissionFlags: [PermissionFlagType.AI_SETTINGS],
    }),
  )
  async deleteAiSystemPromptOverride(
    @Args('sectionKey', { type: () => String }) sectionKey: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    await this.aiSystemPromptOverrideService.delete(workspace.id, sectionKey);

    return true;
  }
}
