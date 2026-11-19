import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeatureFlagKey } from 'twenty-shared/types';
import { DataSource } from 'typeorm';

import { BillingCreditGrantService } from 'src/engine/core-modules/billing/services/billing-credit-grant.service';
import { BillingCreditService } from 'src/engine/core-modules/billing/services/billing-credit.service';
import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { CacheLockService } from 'src/engine/core-modules/cache-lock/cache-lock.service';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import {
  OnboardingService,
  OnboardingStepKeys,
} from 'src/engine/core-modules/onboarding/onboarding.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { OnboardingInviteSuggestionsService } from 'src/modules/onboarding-invite-suggestions/services/onboarding-invite-suggestions.service';

const USER_WORKSPACE = { userId: 'user-id', workspaceId: 'workspace-id' };

describe('OnboardingService without Getting Started @custom', () => {
  const userVarsService = {
    get: jest.fn().mockResolvedValue([]),
    set: jest.fn(),
    delete: jest.fn().mockResolvedValue(1),
    setIfNotExists: jest.fn().mockResolvedValue(true),
  };
  const featureFlagService = {
    isFeatureEnabled: jest.fn().mockResolvedValue(true),
    getWorkspaceFeatureFlagsMap: jest.fn().mockResolvedValue({
      [FeatureFlagKey.IS_GETTING_STARTED_ENABLED]: true,
    }),
  };
  const inviteSuggestionsService = {
    getOrComputeSuggestions: jest
      .fn()
      .mockResolvedValue([{ email: 'invite@example.com' }]),
  };
  const configuration: Record<string, string | number | undefined> = {
    CALENDAR_BOOKING_PAGE_ID: 'team/example/book-call',
    ONBOARDING_BOOK_CALL_MIN_EMPLOYEE_COUNT: 50,
  };
  const queryRunner = { query: jest.fn() };
  let service: OnboardingService;

  beforeEach(async () => {
    configuration.CALENDAR_BOOKING_PAGE_ID = 'team/example/book-call';
    const module = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: BillingService, useValue: { isBillingEnabled: () => true } },
        {
          provide: BillingCreditService,
          useValue: { grantCredits: jest.fn() },
        },
        { provide: BillingCreditGrantService, useValue: {} },
        { provide: CacheLockService, useValue: {} },
        { provide: ExceptionHandlerService, useValue: {} },
        { provide: FeatureFlagService, useValue: featureFlagService },
        {
          provide: OnboardingInviteSuggestionsService,
          useValue: inviteSuggestionsService,
        },
        { provide: UserVarsService, useValue: userVarsService },
        {
          provide: TwentyConfigService,
          useValue: { get: (key: string) => configuration[key] },
        },
        { provide: getRepositoryToken(WorkspaceEntity), useValue: {} },
        {
          provide: getRepositoryToken(UserWorkspaceEntity),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              ...USER_WORKSPACE,
              id: 'user-workspace-id',
              user: { email: 'member@example.com' },
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: (
              callback: (manager: {
                queryRunner: typeof queryRunner;
              }) => Promise<unknown>,
            ) => callback({ queryRunner }),
          },
        },
      ],
    }).compile();

    service = module.get(OnboardingService);
  });

  it('does not add invite-team onboarding after account connection with billing and the flag on @custom', async () => {
    await service.completeOnboardingConnectAccountStep(USER_WORKSPACE);

    expect(
      inviteSuggestionsService.getOrComputeSuggestions,
    ).not.toHaveBeenCalled();
    expect(
      userVarsService.set.mock.calls.map(([entry]) => entry.key),
    ).not.toContain(OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING);
    expect(featureFlagService.isFeatureEnabled).not.toHaveBeenCalled();
  });

  it('keeps the old qualified book-call offer even when the flag is on @custom', async () => {
    await expect(
      service.setOnboardingBookCallPendingIfQualified({
        ...USER_WORKSPACE,
        employeeCount: 50,
      }),
    ).resolves.toBe(true);
    expect(userVarsService.set).toHaveBeenCalledWith(
      {
        ...USER_WORKSPACE,
        key: OnboardingStepKeys.ONBOARDING_BOOK_CALL_PENDING,
        value: true,
      },
      queryRunner,
    );
    expect(featureFlagService.isFeatureEnabled).not.toHaveBeenCalled();
  });

  it('keeps the old book-call step off without booking configuration @custom', async () => {
    configuration.CALENDAR_BOOKING_PAGE_ID = undefined;

    await expect(
      service.setOnboardingBookCallPendingIfQualified({
        ...USER_WORKSPACE,
        employeeCount: 50,
      }),
    ).resolves.toBe(false);
    expect(userVarsService.setIfNotExists).not.toHaveBeenCalled();
  });
});
