import { getAppProviderByClassName } from 'test/integration/utils/get-app-provider-by-class-name.util';
import { STANDARD_OBJECT_FIELDS } from 'twenty-shared/metadata';
import { FieldMetadataType, MetadataWritability } from 'twenty-shared/types';

import { type AddMessageRawProviderDataCommand } from 'src/database/commands/upgrade-version-command/2-46/2-46-workspace-command-1791529667992-add-message-raw-provider-data.command';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { SEED_APPLE_WORKSPACE_ID } from 'src/engine/workspace-manager/dev-seeder/core/constants/seeder-workspaces.constant';

const RUN_ON_WORKSPACE_ARGS = {
  workspaceId: SEED_APPLE_WORKSPACE_ID,
  options: {},
  index: 0,
  total: 1,
};

const SCHEMA = getWorkspaceSchemaName(SEED_APPLE_WORKSPACE_ID);
const RAW_PROVIDER_DATA_FIELD_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECT_FIELDS.message.rawProviderData.universalIdentifier;

describe('2-46 workspace command - add Message raw provider data @custom', () => {
  it('adds the field to a populated workspace and preserves existing messages', async () => {
    const command = getAppProviderByClassName<AddMessageRawProviderDataCommand>(
      'AddMessageRawProviderDataCommand',
    );
    const workspaceCacheService =
      getAppProviderByClassName<WorkspaceCacheService>('WorkspaceCacheService');
    const workspaceOrmManager = getAppProviderByClassName<WorkspaceOrmManager>(
      'WorkspaceOrmManager',
    );
    const runCommand = (direction: 'up' | 'down') =>
      workspaceOrmManager.executeInWorkspaceContext(
        () => command[direction](RUN_ON_WORKSPACE_ARGS),
        buildSystemAuthContext(SEED_APPLE_WORKSPACE_ID),
      );
    const messageStateBefore = await global.testDataSource.query(
      `SELECT id, "headerMessageId", subject, text, "messageThreadId"
         FROM "${SCHEMA}"."message" ORDER BY id`,
    );

    try {
      await runCommand('down');

      const { flatFieldMetadataMaps: fieldsAfterDown } =
        await workspaceCacheService.getOrRecompute(SEED_APPLE_WORKSPACE_ID, [
          'flatFieldMetadataMaps',
        ]);

      expect(
        fieldsAfterDown.byUniversalIdentifier[
          RAW_PROVIDER_DATA_FIELD_UNIVERSAL_IDENTIFIER
        ],
      ).toBeUndefined();

      await runCommand('up');

      const { flatFieldMetadataMaps: fieldsAfterUp } =
        await workspaceCacheService.getOrRecompute(SEED_APPLE_WORKSPACE_ID, [
          'flatFieldMetadataMaps',
        ]);
      const rawProviderDataField =
        fieldsAfterUp.byUniversalIdentifier[
          RAW_PROVIDER_DATA_FIELD_UNIVERSAL_IDENTIFIER
        ];

      expect(rawProviderDataField).toMatchObject({
        name: 'rawProviderData',
        type: FieldMetadataType.RAW_JSON,
        isSystem: true,
        isNullable: true,
        isUIEditable: false,
        writability: MetadataWritability.SYSTEM,
        isAuditLogged: false,
      });
      const messageStateAfter = await global.testDataSource.query(
        `SELECT id, "headerMessageId", subject, text, "messageThreadId"
           FROM "${SCHEMA}"."message" ORDER BY id`,
      );

      expect(messageStateAfter).toEqual(messageStateBefore);
    } finally {
      await runCommand('up');
      await workspaceCacheService.getOrRecompute(SEED_APPLE_WORKSPACE_ID, [
        'flatFieldMetadataMaps',
      ]);
    }
  });
});
