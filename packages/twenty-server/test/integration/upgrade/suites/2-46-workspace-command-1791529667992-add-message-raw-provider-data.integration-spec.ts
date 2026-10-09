import { randomUUID } from 'node:crypto';

import { activateWorkspace } from 'test/integration/graphql/utils/activate-workspace.util';
import { deleteUser } from 'test/integration/graphql/utils/delete-user.util';
import { getAuthTokensFromLoginToken } from 'test/integration/graphql/utils/get-auth-tokens-from-login-token.util';
import { signUpInNewWorkspace } from 'test/integration/graphql/utils/sign-up-in-new-workspace.util';
import { signUp } from 'test/integration/graphql/utils/sign-up.util';
import { getAppProviderByClassName } from 'test/integration/utils/get-app-provider-by-class-name.util';
import { STANDARD_OBJECT_FIELDS } from 'twenty-shared/metadata';
import { FieldMetadataType, MetadataWritability } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { type AddMessageRawProviderDataCommand } from 'src/database/commands/upgrade-version-command/2-46/2-46-workspace-command-1791529667992-add-message-raw-provider-data.command';
import { type WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

const RAW_PROVIDER_DATA_FIELD_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECT_FIELDS.message.rawProviderData.universalIdentifier;

describe('2-46 workspace command - add Message raw provider data @custom', () => {
  it('adds the field to a populated workspace and preserves existing messages', async () => {
    let userAccessToken: string | undefined;
    let workspaceId: string | undefined;

    try {
      const uniqueEmail = `test-message-raw-migration-${randomUUID()}@example.com`;
      const { data: signUpData } = await signUp({
        input: { email: uniqueEmail, password: 'Test123!@#' },
        expectToFail: false,
      });

      userAccessToken =
        signUpData.signUp.tokens.accessOrWorkspaceAgnosticToken.token;

      await global.testDataSource.query(
        'UPDATE core."user" SET "isEmailVerified" = true WHERE email = $1',
        [uniqueEmail],
      );

      const {
        data: { signUpInNewWorkspace: newWorkspaceData },
      } = await signUpInNewWorkspace({
        accessToken: userAccessToken,
        expectToFail: false,
      });

      const newWorkspaceId = newWorkspaceData.workspace.id;

      workspaceId = newWorkspaceId;

      const {
        data: { getAuthTokensFromLoginToken: authTokensData },
      } = await getAuthTokensFromLoginToken({
        origin: newWorkspaceData.workspace.workspaceUrls.subdomainUrl,
        loginToken: newWorkspaceData.loginToken.token,
        expectToFail: false,
      });
      const workspaceAccessToken =
        authTokensData.tokens.accessOrWorkspaceAgnosticToken.token;

      await activateWorkspace({
        accessToken: workspaceAccessToken,
        expectToFail: false,
      });

      const command =
        getAppProviderByClassName<AddMessageRawProviderDataCommand>(
          'AddMessageRawProviderDataCommand',
        );
      const workspaceCacheService =
        getAppProviderByClassName<WorkspaceCacheService>(
          'WorkspaceCacheService',
        );
      const workspaceOrmManager =
        getAppProviderByClassName<WorkspaceOrmManager>('WorkspaceOrmManager');
      const messageId = randomUUID();
      const messageThreadId = randomUUID();
      const workspaceSchema = getWorkspaceSchemaName(newWorkspaceId);
      const runCommand = (direction: 'up' | 'down') =>
        workspaceOrmManager.executeInWorkspaceContext(
          () =>
            command[direction]({
              workspaceId: newWorkspaceId,
              options: {},
              index: 0,
              total: 1,
            }),
          buildSystemAuthContext(newWorkspaceId),
        );

      await global.testDataSource.query(
        `INSERT INTO "${workspaceSchema}"."messageThread" (id, subject)
         VALUES ($1, $2)`,
        [messageThreadId, 'Existing thread'],
      );
      await global.testDataSource.query(
        `INSERT INTO "${workspaceSchema}"."message"
           (id, "headerMessageId", "messageThreadId", subject, "receivedAt", text, "isDraft")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          messageId,
          `<${messageId}@migration.test>`,
          messageThreadId,
          'Existing subject',
          new Date('2026-01-01T10:00:00.000Z'),
          'Existing body',
          false,
        ],
      );

      const messageStateBefore = await global.testDataSource.query(
        `SELECT id, "headerMessageId", subject, text, "messageThreadId"
           FROM "${workspaceSchema}"."message" WHERE id = $1`,
        [messageId],
      );

      await runCommand('down');

      const { flatFieldMetadataMaps: fieldsAfterDown } =
        await workspaceCacheService.getOrRecompute(newWorkspaceId, [
          'flatFieldMetadataMaps',
        ]);

      expect(
        fieldsAfterDown.byUniversalIdentifier[
          RAW_PROVIDER_DATA_FIELD_UNIVERSAL_IDENTIFIER
        ],
      ).toBeUndefined();

      await runCommand('up');

      const { flatFieldMetadataMaps: fieldsAfterUp } =
        await workspaceCacheService.getOrRecompute(newWorkspaceId, [
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
        `SELECT id, "headerMessageId", subject, text, "messageThreadId",
                "rawProviderData"
           FROM "${workspaceSchema}"."message" WHERE id = $1`,
        [messageId],
      );

      expect(messageStateAfter).toEqual([
        {
          ...messageStateBefore[0],
          rawProviderData: null,
        },
      ]);
    } finally {
      try {
        if (isDefined(workspaceId)) {
          const [workspace] = await global.testDataSource.query(
            'SELECT id FROM core."workspace" WHERE id = $1',
            [workspaceId],
          );

          if (isDefined(workspace)) {
            const workspaceService =
              getAppProviderByClassName<WorkspaceService>('WorkspaceService');

            await workspaceService.deleteWorkspace(workspaceId);
          }
        }
      } finally {
        if (isDefined(userAccessToken)) {
          await deleteUser({ accessToken: userAccessToken });
        }
      }
    }
  }, 180000);
});
