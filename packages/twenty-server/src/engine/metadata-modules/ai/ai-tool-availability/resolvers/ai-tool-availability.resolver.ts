import { msg } from '@lingui/core/macro';
import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';
import { isDefined, isValidUuid } from 'twenty-shared/utils';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AccessPolicyGuard } from 'src/engine/guards/access-policy.guard';
import {
  AI_CHAT_EXCLUDED_TOOL_NAMES,
  MCP_EXCLUDED_TOOL_NAMES,
} from 'src/engine/metadata-modules/ai/ai-tool-availability/constants/ai-tool-never-offered-tool-names.constant';
import { AiToolAvailabilityLimitsDTO } from 'src/engine/metadata-modules/ai/ai-tool-availability/dtos/ai-tool-availability-limits.dto';
import { AiToolAvailabilityDTO } from 'src/engine/metadata-modules/ai/ai-tool-availability/dtos/ai-tool-availability.dto';
import { SetAiToolAvailabilitiesInput } from 'src/engine/metadata-modules/ai/ai-tool-availability/dtos/set-ai-tool-availabilities.input';
import { SetAiToolAvailabilityInput } from 'src/engine/metadata-modules/ai/ai-tool-availability/dtos/set-ai-tool-availability.input';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/permissions/utils/permissions-graphql-api-exception.filter';

@MetadataResolver(() => AiToolAvailabilityDTO)
@UsePipes(ResolverValidationPipe)
@UseFilters(
  PreventNestToAutoLogGraphqlErrorsFilter,
  PermissionsGraphqlApiExceptionFilter,
  AuthGraphqlApiExceptionFilter,
)
export class AiToolAvailabilityResolver {
  constructor(
    private readonly aiToolAvailabilityService: AiToolAvailabilityService,
    private readonly toolRegistryService: ToolRegistryService,
  ) {}

  @Query(() => AiToolAvailabilityLimitsDTO)
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
  aiToolAvailabilityLimits(): AiToolAvailabilityLimitsDTO {
    return {
      neverAvailableToAgents: [...AI_CHAT_EXCLUDED_TOOL_NAMES],
      neverAvailableOverMcp: [...MCP_EXCLUDED_TOOL_NAMES],
    };
  }

  @Query(() => [AiToolAvailabilityDTO])
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
  async aiToolAvailabilities(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ): Promise<AiToolAvailabilityDTO[]> {
    const rows = await this.aiToolAvailabilityService.findAll(workspace.id);

    if (rows.length === 0) {
      return [];
    }

    const toolNameByStableKey = new Map<string, string>();

    const catalog = await this.toolRegistryService.buildToolIndex(
      workspace.id,
      {
        toolAvailabilityChannel: 'unfiltered',
        authContext: getWorkspaceAuthContext(),
        userId: user.id,
        userWorkspaceId,
      },
    );
    const stableKeysByToolName =
      await this.aiToolAvailabilityService.getStableKeysByToolName(
        workspace.id,
        catalog,
      );

    for (const [toolName, stableKey] of stableKeysByToolName) {
      if (isDefined(stableKey)) {
        toolNameByStableKey.set(stableKey, toolName);
      }
    }

    return rows.flatMap(({ stableKey, isAgentEnabled, isMcpEnabled }) => {
      const toolIdentifier = stableKey.startsWith('logicFunction:')
        ? stableKey.slice('logicFunction:'.length)
        : stableKey.startsWith('tool:')
          ? stableKey.slice('tool:'.length)
          : toolNameByStableKey.get(stableKey);

      return isDefined(toolIdentifier)
        ? [
            {
              toolIdentifier,
              toolName: toolNameByStableKey.get(stableKey) ?? null,
              isAgentEnabled,
              isMcpEnabled,
            },
          ]
        : [];
    });
  }

  @Mutation(() => AiToolAvailabilityDTO)
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
  async setAiToolAvailability(
    @Args('input') input: SetAiToolAvailabilityInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ): Promise<AiToolAvailabilityDTO> {
    const [availability] = await this.setAvailabilities(
      workspace,
      user,
      userWorkspaceId,
      [input],
    );

    return availability;
  }

  @Mutation(() => [AiToolAvailabilityDTO])
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
  async setAiToolAvailabilities(
    @Args('input') input: SetAiToolAvailabilitiesInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ): Promise<AiToolAvailabilityDTO[]> {
    return this.setAvailabilities(
      workspace,
      user,
      userWorkspaceId,
      input.items,
    );
  }

  private async setAvailabilities(
    workspace: WorkspaceEntity,
    user: UserEntity,
    userWorkspaceId: string,
    items: SetAiToolAvailabilityInput[],
  ): Promise<AiToolAvailabilityDTO[]> {
    const catalog = await this.toolRegistryService.buildToolIndex(
      workspace.id,
      {
        toolAvailabilityChannel: 'unfiltered',
        authContext: getWorkspaceAuthContext(),
        userId: user.id,
        userWorkspaceId,
      },
    );
    const entries = items.map((input) => {
      const entry = isValidUuid(input.toolIdentifier)
        ? catalog.find(
            ({ executionRef }) =>
              executionRef.kind === 'logic_function' &&
              executionRef.logicFunctionId === input.toolIdentifier,
          )
        : catalog.find(({ name }) => name === input.toolIdentifier);

      if (!isDefined(entry)) {
        throw new UserInputError('Tool not found.', {
          userFriendlyMessage: msg`Tool not found.`,
        });
      }

      return entry;
    });
    const stableKeysByToolName =
      await this.aiToolAvailabilityService.getStableKeysByToolName(
        workspace.id,
        entries,
      );
    const resolvedEntries = entries.map((entry, index) => {
      const stableKey = stableKeysByToolName.get(entry.name);

      if (!isDefined(stableKey)) {
        throw new UserInputError('Tool not found.', {
          userFriendlyMessage: msg`Tool not found.`,
        });
      }

      const { isAgentEnabled, isMcpEnabled } = items[index];

      return { stableKey, availability: { isAgentEnabled, isMcpEnabled } };
    });

    await this.aiToolAvailabilityService.setMany(workspace.id, resolvedEntries);

    return items.map((input, index) => ({
      ...input,
      toolName: entries[index].name,
    }));
  }
}
