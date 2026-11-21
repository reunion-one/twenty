import { ToolCategory } from 'twenty-shared/ai';

import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type ToolExecutionRef } from 'src/engine/core-modules/tool-provider/types/tool-execution-ref.type';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';

describe('@custom AiToolAvailabilityService getStableKeysByToolName', () => {
  const keyValuePairService = { get: jest.fn() };
  const workspaceCacheService = { getOrRecompute: jest.fn() };
  const service = new AiToolAvailabilityService(
    keyValuePairService as unknown as ConstructorParameters<
      typeof AiToolAvailabilityService
    >[0],
    {} as ConstructorParameters<typeof AiToolAvailabilityService>[1],
    workspaceCacheService as unknown as ConstructorParameters<
      typeof AiToolAvailabilityService
    >[2],
  );
  const entry = (
    name: string,
    executionRef: ToolExecutionRef,
  ): ToolIndexEntry => ({
    name,
    label: name,
    description: name,
    category: ToolCategory.DATABASE_CRUD,
    executionRef,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    workspaceCacheService.getOrRecompute.mockResolvedValue({
      flatObjectMetadataMaps: {
        byUniversalIdentifier: {
          object: {
            id: 'object-id',
            nameSingular: 'person',
            namePlural: 'people',
          },
        },
      },
    });
  });

  it('maps non-record kinds without querying storage or object maps', async () => {
    const catalog = [
      entry('search', { kind: 'static', toolId: 'search' }),
      entry('app_function', {
        kind: 'logic_function',
        logicFunctionId: 'function-id',
      }),
      entry('mcp_remote_tool', {
        kind: 'mcp_server_tool',
        mcpServerId: 'server-id',
        toolName: 'remote_tool',
      }),
    ];
    expect(await service.getStableKeysByToolName('workspace', catalog)).toEqual(
      new Map([
        ['search', 'tool:search'],
        ['app_function', 'logicFunction:function-id'],
        ['mcp_remote_tool', 'mcpServer:server-id:remote_tool'],
      ]),
    );
    expect(await service.getStableKeysByToolName('workspace', [])).toEqual(
      new Map(),
    );
    expect(workspaceCacheService.getOrRecompute).not.toHaveBeenCalled();
    expect(keyValuePairService.get).not.toHaveBeenCalled();
  });

  it('loads object maps once for the catalog and preserves undefined keys', async () => {
    const catalog = [
      entry('find_many_people', {
        kind: 'database_crud',
        objectNameSingular: 'person',
        operation: 'find_many',
      }),
      entry('create_one_person', {
        kind: 'database_crud',
        objectNameSingular: 'person',
        operation: 'create_one',
      }),
      entry('find_many_missing', {
        kind: 'database_crud',
        objectNameSingular: 'missing',
        operation: 'find_many',
      }),
    ];
    expect(await service.getStableKeysByToolName('workspace', catalog)).toEqual(
      new Map([
        ['find_many_people', 'object:object-id:find_many'],
        ['create_one_person', 'object:object-id:create_one'],
        ['find_many_missing', undefined],
      ]),
    );
    expect(workspaceCacheService.getOrRecompute).toHaveBeenCalledTimes(1);
    expect(workspaceCacheService.getOrRecompute).toHaveBeenCalledWith(
      'workspace',
      ['flatObjectMetadataMaps'],
    );
    expect(keyValuePairService.get).not.toHaveBeenCalled();
  });
});
