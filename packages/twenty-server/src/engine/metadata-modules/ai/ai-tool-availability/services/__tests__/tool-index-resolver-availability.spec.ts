import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { ToolIndexResolver } from 'src/engine/core-modules/tool-provider/resolvers/tool-index.resolver';
import { type ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

jest.mock(
  'src/engine/core-modules/auth/storage/workspace-auth-context.storage',
  () => ({ getWorkspaceAuthContext: jest.fn() }),
);

describe('@custom ToolIndexResolver availability channel upgrade guard', () => {
  const registry = { buildToolIndex: jest.fn(), resolveSchemas: jest.fn() };
  const resolver = new ToolIndexResolver(
    registry as unknown as ToolRegistryService,
  );
  const user = { id: 'user' } as UserEntity;
  const workspace = { id: 'workspace' } as WorkspaceEntity;

  beforeEach(() => jest.resetAllMocks());

  it('lists the Settings catalog with the unfiltered channel', async () => {
    registry.buildToolIndex.mockResolvedValue([{ name: 'disabled_tool' }]);
    expect(
      await resolver.getToolIndex(
        user,
        workspace,
        'user-workspace',
        undefined,
        undefined,
      ),
    ).toEqual([{ name: 'disabled_tool' }]);
    expect(registry.buildToolIndex).toHaveBeenCalledWith(
      'workspace',
      expect.objectContaining({
        toolAvailabilityChannel: 'unfiltered',
        userId: 'user',
        userWorkspaceId: 'user-workspace',
        authContext: getWorkspaceAuthContext(),
      }),
    );
  });

  it('resolves Settings schemas with the unfiltered channel', async () => {
    const schema = { type: 'object' };
    registry.resolveSchemas.mockResolvedValue(
      new Map([['disabled_tool', schema]]),
    );
    expect(
      await resolver.getToolInputSchema(
        'disabled_tool',
        user,
        workspace,
        'user-workspace',
        undefined,
      ),
    ).toBe(schema);
    expect(registry.resolveSchemas).toHaveBeenCalledWith({
      toolNames: ['disabled_tool'],
      context: expect.objectContaining({
        toolAvailabilityChannel: 'unfiltered',
        workspaceId: 'workspace',
        userId: 'user',
        userWorkspaceId: 'user-workspace',
        authContext: getWorkspaceAuthContext(),
      }),
    });
  });
});
