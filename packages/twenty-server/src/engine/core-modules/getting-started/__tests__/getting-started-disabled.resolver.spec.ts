import {
  type CanActivate,
  ForbiddenException,
  type Type,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';
import { FeatureFlagKey } from 'twenty-shared/types';

import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { GettingStartedResolver } from 'src/engine/core-modules/getting-started/getting-started.resolver';
import { GettingStartedWorkflowResolver } from 'src/engine/core-modules/getting-started/getting-started-workflow.resolver';
import { AccessPolicyService } from 'src/engine/guards/access-policy/access-policy.service';
import { SettingPermissionsService } from 'src/engine/permissions/setting-permissions.service';

const RESOLVER_METHODS = [
  {
    name: 'gettingStartedProgress',
    resolver: GettingStartedResolver,
    method: GettingStartedResolver.prototype.gettingStartedProgress,
  },
  {
    name: 'updateGettingStarted',
    resolver: GettingStartedResolver,
    method: GettingStartedResolver.prototype.updateGettingStarted,
  },
  {
    name: 'gettingStartedWorkflowPreviews',
    resolver: GettingStartedWorkflowResolver,
    method:
      GettingStartedWorkflowResolver.prototype.gettingStartedWorkflowPreviews,
  },
  {
    name: 'prepareGettingStartedWorkflow',
    resolver: GettingStartedWorkflowResolver,
    method:
      GettingStartedWorkflowResolver.prototype.prepareGettingStartedWorkflow,
  },
];

describe('Getting Started resolvers disabled @custom', () => {
  it.each(RESOLVER_METHODS)(
    'rejects $name before dispatch even with the flag enabled',
    async ({ resolver, method }) => {
      const guards: Type<CanActivate>[] = Reflect.getMetadata(
        GUARDS_METADATA,
        resolver,
      );
      const accessGuard = guards[0];
      const featureFlagService = {
        getWorkspaceFeatureFlagsMap: jest.fn().mockResolvedValue({
          [FeatureFlagKey.IS_GETTING_STARTED_ENABLED]: true,
        }),
      };
      const settingPermissionsService = {
        hasPermissionFlag: jest.fn().mockResolvedValue(true),
      };
      const module = await Test.createTestingModule({
        providers: [
          accessGuard,
          AccessPolicyService,
          { provide: FeatureFlagService, useValue: featureFlagService },
          {
            provide: SettingPermissionsService,
            useValue: settingPermissionsService,
          },
        ],
      }).compile();
      const context = new ExecutionContextHost(
        [
          undefined,
          {},
          {
            req: {
              user: { id: 'user-id' },
              workspace: { id: 'workspace-id' },
              tokenType: JwtTokenTypeEnum.ACCESS,
            },
          },
          undefined,
        ],
        resolver,
        method,
      );

      context.setType('graphql');
      const dispatch = jest.fn(() => Reflect.apply(method, undefined, []));
      const invoke = async () => {
        await module.get<CanActivate>(accessGuard).canActivate(context);

        return dispatch();
      };

      await expect(invoke()).rejects.toThrow(ForbiddenException);
      expect(dispatch).not.toHaveBeenCalled();
      expect(
        featureFlagService.getWorkspaceFeatureFlagsMap,
      ).not.toHaveBeenCalled();
      expect(
        settingPermissionsService.hasPermissionFlag,
      ).not.toHaveBeenCalled();
      await module.close();
    },
  );
});
