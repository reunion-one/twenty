import { msg } from '@lingui/core/macro';
import { ToolCategory } from 'twenty-shared/ai';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { type ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AiToolAvailabilityResolver } from 'src/engine/metadata-modules/ai/ai-tool-availability/resolvers/ai-tool-availability.resolver';
import { type AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';

jest.mock(
  'src/engine/core-modules/auth/storage/workspace-auth-context.storage',
  () => ({ getWorkspaceAuthContext: jest.fn() }),
);

describe('@custom AiToolAvailabilityResolver', () => {
  const logicFunctionId = 'f0b69e11-b286-4b42-a363-a83875df5ee7';
  const unknownId = 'a92d38d4-9e05-4414-b716-cafadf94c0b8';
  const workspace = { id: 'workspace' } as WorkspaceEntity;
  const user = { id: 'user' } as UserEntity;
  const availability = { isAgentEnabled: false, isMcpEnabled: true };
  const catalog: ToolIndexEntry[] = [
    {
      name: 'app_renamed_function',
      label: 'Function',
      description: 'Function',
      category: ToolCategory.DATABASE_CRUD,
      executionRef: { kind: 'logic_function', logicFunctionId },
    },
    {
      name: 'search',
      label: 'Search',
      description: 'Search',
      category: ToolCategory.DATABASE_CRUD,
      executionRef: { kind: 'static', toolId: 'search' },
    },
    {
      name: 'find_many_renamed_people',
      label: 'People',
      description: 'People',
      category: ToolCategory.DATABASE_CRUD,
      executionRef: {
        kind: 'database_crud',
        objectNameSingular: 'renamedPerson',
        operation: 'find_many',
      },
    },
    {
      name: 'mcp_renamed_server__remote_tool',
      label: 'Remote',
      description: 'Remote',
      category: ToolCategory.DATABASE_CRUD,
      executionRef: {
        kind: 'mcp_server_tool',
        mcpServerId: 'server-id',
        toolName: 'remote_tool',
      },
    },
    {
      name: unknownId,
      label: 'UUID name',
      description: 'UUID name',
      category: ToolCategory.DATABASE_CRUD,
      executionRef: { kind: 'static', toolId: unknownId },
    },
  ];
  const stableKeysByToolName = new Map([
    [catalog[0].name, `logicFunction:${logicFunctionId}`],
    [catalog[1].name, 'tool:search'],
    [catalog[2].name, 'object:object-id:find_many'],
    [catalog[3].name, 'mcpServer:server-id:remote_tool'],
  ]);
  const service = {
    findAll: jest.fn(),
    getStableKeysByToolName: jest.fn(),
    setMany: jest.fn(),
  };
  const registry = { buildToolIndex: jest.fn() };
  const resolver = new AiToolAvailabilityResolver(
    service as unknown as AiToolAvailabilityService,
    registry as unknown as ToolRegistryService,
  );
  const buildOptions = {
    toolAvailabilityChannel: 'unfiltered',
    authContext: { workspaceId: 'workspace' },
    userId: 'user',
    userWorkspaceId: 'user-workspace',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getWorkspaceAuthContext)
      .mockReturnValue(
        buildOptions.authContext as unknown as ReturnType<
          typeof getWorkspaceAuthContext
        >,
      );
    registry.buildToolIndex.mockResolvedValue(catalog);
    service.getStableKeysByToolName.mockResolvedValue(stableKeysByToolName);
    service.findAll.mockResolvedValue([]);
  });

  it.each([
    [logicFunctionId, `logicFunction:${logicFunctionId}`, 0],
    ['find_many_renamed_people', 'object:object-id:find_many', 2],
  ] as const)(
    'resolves identifier %s in the unfiltered caller catalog',
    async (toolIdentifier, stableKey, catalogIndex) => {
      const input = { toolIdentifier, ...availability };
      expect(
        await resolver.setAiToolAvailability(
          input,
          workspace,
          user,
          'user-workspace',
        ),
      ).toEqual({ ...input, toolName: catalog[catalogIndex].name });
      expect(registry.buildToolIndex).toHaveBeenCalledTimes(1);
      expect(registry.buildToolIndex).toHaveBeenCalledWith(
        'workspace',
        buildOptions,
      );
      expect(service.getStableKeysByToolName).toHaveBeenCalledWith(
        'workspace',
        [catalog[catalogIndex]],
      );
      expect(service.setMany).toHaveBeenCalledWith('workspace', [
        { stableKey, availability },
      ]);
    },
  );

  it.each(['missing', unknownId])(
    'rejects unknown identifiers and UUIDs without a logic function: %s',
    async (toolIdentifier) => {
      const result = resolver.setAiToolAvailability(
        { toolIdentifier, ...availability },
        workspace,
        user,
        'user-workspace',
      );
      await expect(result).rejects.toBeInstanceOf(UserInputError);
      await expect(result).rejects.toMatchObject({
        extensions: {
          code: 'BAD_USER_INPUT',
          userFriendlyMessage: msg`Tool not found.`,
        },
      });
      expect(service.setMany).not.toHaveBeenCalled();
    },
  );

  it('rejects an entry with no stable key', async () => {
    service.getStableKeysByToolName.mockResolvedValue(
      new Map([[catalog[2].name, undefined]]),
    );
    await expect(
      resolver.setAiToolAvailability(
        { toolIdentifier: catalog[2].name, ...availability },
        workspace,
        user,
        'user-workspace',
      ),
    ).rejects.toBeInstanceOf(UserInputError);
    expect(service.setMany).not.toHaveBeenCalled();
  });

  it('resolves a batch once and returns each item in input order', async () => {
    const items = [
      { toolIdentifier: logicFunctionId, ...availability },
      {
        toolIdentifier: catalog[2].name,
        isAgentEnabled: true,
        isMcpEnabled: false,
      },
      { toolIdentifier: 'search', ...availability },
    ];
    expect(
      await resolver.setAiToolAvailabilities(
        { items },
        workspace,
        user,
        'user-workspace',
      ),
    ).toEqual(
      items.map((input, index) => ({
        ...input,
        toolName: [catalog[0].name, catalog[2].name, 'search'][index],
      })),
    );
    expect(registry.buildToolIndex).toHaveBeenCalledTimes(1);
    expect(registry.buildToolIndex).toHaveBeenCalledWith(
      'workspace',
      buildOptions,
    );
    expect(service.getStableKeysByToolName).toHaveBeenCalledTimes(1);
    expect(service.getStableKeysByToolName).toHaveBeenCalledWith('workspace', [
      catalog[0],
      catalog[2],
      catalog[1],
    ]);
    expect(service.setMany).toHaveBeenCalledTimes(1);
    expect(service.setMany).toHaveBeenCalledWith('workspace', [
      { stableKey: `logicFunction:${logicFunctionId}`, availability },
      {
        stableKey: 'object:object-id:find_many',
        availability: { isAgentEnabled: true, isMcpEnabled: false },
      },
      { stableKey: 'tool:search', availability },
    ]);
  });

  it('rejects an entire batch when one identifier is unknown', async () => {
    await expect(
      resolver.setAiToolAvailabilities(
        {
          items: [
            { toolIdentifier: 'search', ...availability },
            { toolIdentifier: 'missing', ...availability },
          ],
        },
        workspace,
        user,
        'user-workspace',
      ),
    ).rejects.toThrow('Tool not found.');
    expect(service.setMany).not.toHaveBeenCalled();
  });

  it('maps all row kinds to current names once, retains missing functions and skips unresolved objects', async () => {
    service.findAll.mockResolvedValue([
      { stableKey: `logicFunction:${logicFunctionId}`, ...availability },
      { stableKey: 'tool:search', ...availability },
      { stableKey: `logicFunction:${unknownId}`, ...availability },
      { stableKey: 'object:object-id:find_many', ...availability },
      { stableKey: 'mcpServer:server-id:remote_tool', ...availability },
      { stableKey: 'object:deleted-id:find_many', ...availability },
    ]);
    expect(
      await resolver.aiToolAvailabilities(workspace, user, 'user-workspace'),
    ).toEqual([
      {
        toolIdentifier: logicFunctionId,
        toolName: catalog[0].name,
        ...availability,
      },
      { toolIdentifier: 'search', toolName: catalog[1].name, ...availability },
      { toolIdentifier: unknownId, toolName: null, ...availability },
      {
        toolIdentifier: catalog[2].name,
        toolName: catalog[2].name,
        ...availability,
      },
      {
        toolIdentifier: catalog[3].name,
        toolName: catalog[3].name,
        ...availability,
      },
    ]);
    expect(registry.buildToolIndex).toHaveBeenCalledTimes(1);
    expect(registry.buildToolIndex).toHaveBeenCalledWith(
      'workspace',
      buildOptions,
    );
    expect(service.getStableKeysByToolName).toHaveBeenCalledTimes(1);
    expect(service.getStableKeysByToolName).toHaveBeenCalledWith(
      'workspace',
      catalog,
    );
  });

  it('returns no rows without building a catalog', async () => {
    expect(
      await resolver.aiToolAvailabilities(workspace, user, 'user-workspace'),
    ).toEqual([]);
    expect(registry.buildToolIndex).not.toHaveBeenCalled();
    expect(service.getStableKeysByToolName).not.toHaveBeenCalled();
  });

  it('reports the tools never offered to agents and over MCP', () => {
    const limits = resolver.aiToolAvailabilityLimits();

    expect(limits.neverAvailableToAgents).toEqual(
      expect.arrayContaining(['create_file_upload', 'complete_file_upload']),
    );
    expect(limits.neverAvailableOverMcp).toEqual(
      expect.arrayContaining(['code_interpreter', 'http_request', 'read_file']),
    );
  });
});
