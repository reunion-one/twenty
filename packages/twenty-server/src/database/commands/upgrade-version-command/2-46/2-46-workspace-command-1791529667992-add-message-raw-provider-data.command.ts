import { Command } from 'nest-commander';
import { TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'twenty-shared/application';
import { isDefined, isNonEmptyArray } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const MESSAGE_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-3f6b-4425-80ab-e468899ab4b2';
const MESSAGE_RAW_PROVIDER_DATA_FIELD_UNIVERSAL_IDENTIFIER =
  '8d6210a5-2195-49bc-b03e-2f9f792f7f45';

@RegisteredWorkspaceCommand('2.46.0', 1791529667992)
@Command({
  name: 'upgrade:2-46:add-message-raw-provider-data',
  description: 'Add raw provider data to the Message object',
})
export class AddMessageRawProviderDataCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace(args: RunOnWorkspaceArgs): Promise<void> {
    await this.up(args);
  }

  async up(args: RunOnWorkspaceArgs): Promise<void> {
    await this.syncFields(args, 'up');
  }

  async down(args: RunOnWorkspaceArgs): Promise<void> {
    await this.syncFields(args, 'down');
  }

  private async syncFields(
    { workspaceId, options }: RunOnWorkspaceArgs,
    direction: 'up' | 'down',
  ): Promise<void> {
    const { flatFieldMetadataMaps, flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatFieldMetadataMaps',
        'flatObjectMetadataMaps',
      ]);
    const messageObjectMetadata =
      findFlatEntityByUniversalIdentifier<FlatObjectMetadata>({
        flatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier: MESSAGE_OBJECT_UNIVERSAL_IDENTIFIER,
      });

    if (!isDefined(messageObjectMetadata)) {
      this.logger.log(
        `Message object missing for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const existingFields = [
      findFlatEntityByUniversalIdentifier<FlatFieldMetadata>({
        flatEntityMaps: flatFieldMetadataMaps,
        universalIdentifier:
          MESSAGE_RAW_PROVIDER_DATA_FIELD_UNIVERSAL_IDENTIFIER,
      }),
    ].filter(isDefined);

    if (direction === 'down') {
      await this.runMigration({
        workspaceId,
        applicationUniversalIdentifier:
          TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        flatEntityToCreate: [],
        flatEntityToDelete: existingFields,
        flatEntityToUpdate: [],
        isDryRun: options.dryRun ?? false,
      });

      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );
    const { flatFieldMetadataMaps: standardFieldMetadataMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      }).allFlatEntityMaps;
    const standardField =
      findFlatEntityByUniversalIdentifier<FlatFieldMetadata>({
        flatEntityMaps: standardFieldMetadataMaps,
        universalIdentifier:
          MESSAGE_RAW_PROVIDER_DATA_FIELD_UNIVERSAL_IDENTIFIER,
      });

    if (!isDefined(standardField)) {
      throw new Error('Standard application is missing the Message raw field');
    }

    const fieldsToCreate = existingFields.some(
      (existingField) =>
        existingField.universalIdentifier === standardField.universalIdentifier,
    )
      ? []
      : [standardField];

    await this.runMigration({
      workspaceId,
      applicationUniversalIdentifier:
        twentyStandardFlatApplication.universalIdentifier,
      flatEntityToCreate: fieldsToCreate,
      flatEntityToDelete: [],
      flatEntityToUpdate: [],
      isDryRun: options.dryRun ?? false,
    });
  }

  private async runMigration({
    workspaceId,
    applicationUniversalIdentifier,
    flatEntityToCreate,
    flatEntityToDelete,
    flatEntityToUpdate,
    isDryRun,
  }: {
    workspaceId: string;
    applicationUniversalIdentifier: string;
    flatEntityToCreate: FlatFieldMetadata[];
    flatEntityToDelete: FlatFieldMetadata[];
    flatEntityToUpdate: FlatFieldMetadata[];
    isDryRun: boolean;
  }): Promise<void> {
    if (
      !isNonEmptyArray(flatEntityToCreate) &&
      !isNonEmptyArray(flatEntityToDelete) &&
      !isNonEmptyArray(flatEntityToUpdate)
    ) {
      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would update Message raw provider fields for workspace ${workspaceId}`,
      );

      return;
    }

    const result =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          workspaceId,
          isSystemBuild: true,
          applicationUniversalIdentifier,
          allFlatEntityOperationByMetadataName: {
            fieldMetadata: {
              flatEntityToCreate,
              flatEntityToDelete,
              flatEntityToUpdate,
            },
          },
        },
      );

    if (result.status === 'fail') {
      throw new WorkspaceMigrationBuilderException(result);
    }
  }
}
