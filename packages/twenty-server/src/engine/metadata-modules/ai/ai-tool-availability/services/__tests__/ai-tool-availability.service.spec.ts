import { IsNull, Like, type Repository } from 'typeorm';
import { ToolCategory } from 'twenty-shared/ai';
import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { type KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type ToolExecutionRef } from 'src/engine/core-modules/tool-provider/types/tool-execution-ref.type';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';
import { type AiToolAvailabilityValueMap } from 'src/engine/metadata-modules/ai/ai-tool-availability/types/ai-tool-availability.type';

describe('@custom AiToolAvailabilityService', () => {
  const keyValuePairService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };
  const repository = { delete: jest.fn() };
  const workspaceCacheService = { getOrRecompute: jest.fn() };
  const service = new AiToolAvailabilityService(
    keyValuePairService as unknown as KeyValuePairService<AiToolAvailabilityValueMap>,
    repository as unknown as Repository<KeyValuePairEntity>,
    workspaceCacheService as unknown as WorkspaceCacheService,
  );
  const entry = (executionRef: ToolExecutionRef): ToolIndexEntry => ({
    name: 'tool',
    label: 'Tool',
    description: 'Tool',
    category: ToolCategory.DATABASE_CRUD,
    executionRef,
  });
  const staticEntry = entry({ kind: 'static', toolId: 'search' });
  const rows = [
    {
      key: 'aiToolAvailability:tool:search',
      value: { isAgentEnabled: false, isMcpEnabled: true },
    },
  ];
  beforeEach(() => {
    jest.resetAllMocks();
    keyValuePairService.get.mockResolvedValue(rows);
    workspaceCacheService.getOrRecompute.mockResolvedValue({
      flatObjectMetadataMaps: {
        byUniversalIdentifier: {
          object: { id: 'id', nameSingular: 'person', namePlural: 'people' },
        },
      },
    });
  });
  it.each([undefined, 'mcp'] as const)(
    'filters the active channel %s',
    async (toolAvailabilityChannel) => {
      const entries = [staticEntry];
      expect(
        await service.filterCatalog(
          { workspaceId: 'workspace', toolAvailabilityChannel },
          entries,
        ),
      ).toEqual(toolAvailabilityChannel === 'mcp' ? entries : []);
      expect(keyValuePairService.get).toHaveBeenCalledTimes(1);
      expect(keyValuePairService.get).toHaveBeenCalledWith({
        workspaceId: 'workspace',
        userId: null,
        type: KeyValuePairType.AI_TOOL_AVAILABILITY,
      });
      expect(workspaceCacheService.getOrRecompute).not.toHaveBeenCalled();
    },
  );
  it('bypasses all reads for unfiltered', async () => {
    const entries = [staticEntry];
    const context = {
      workspaceId: 'workspace',
      toolAvailabilityChannel: 'unfiltered',
    } as const;
    expect(await service.filterCatalog(context, entries)).toBe(entries);
    expect(await service.isDisabled(staticEntry, context)).toBe(false);
    expect(keyValuePairService.get).not.toHaveBeenCalled();
  });
  it('returns the original list without loading maps when no rows exist', async () => {
    keyValuePairService.get.mockResolvedValue([]);
    const entries = [staticEntry];
    expect(
      await service.filterCatalog({ workspaceId: 'workspace' }, entries),
    ).toBe(entries);
    expect(workspaceCacheService.getOrRecompute).not.toHaveBeenCalled();
  });
  it('loads object maps once and keeps entries with no stable key', async () => {
    keyValuePairService.get.mockResolvedValue([
      {
        key: 'aiToolAvailability:object:id:find_many',
        value: { isAgentEnabled: true, isMcpEnabled: false },
      },
    ]);
    const objectEntry = entry({
      kind: 'database_crud',
      objectNameSingular: 'person',
      operation: 'find_many',
    });
    const missingEntry = entry({
      ...objectEntry.executionRef,
      kind: 'database_crud',
      objectNameSingular: 'missing',
      operation: 'find_many',
    });
    expect(
      await service.filterCatalog(
        { workspaceId: 'workspace', toolAvailabilityChannel: 'mcp' },
        [objectEntry, missingEntry, staticEntry],
      ),
    ).toEqual([missingEntry, staticEntry]);
    expect(workspaceCacheService.getOrRecompute).toHaveBeenCalledTimes(1);
    expect(workspaceCacheService.getOrRecompute).toHaveBeenCalledWith(
      'workspace',
      ['flatObjectMetadataMaps'],
    );
  });
  it.each<[ToolExecutionRef, string]>([
    [{ kind: 'static', toolId: 'search' }, 'tool:search'],
    [
      {
        kind: 'database_crud',
        objectNameSingular: 'person',
        operation: 'find_many',
      },
      'object:id:find_many',
    ],
  ])(
    'refuses %j only on its disabled channel',
    async (executionRef, stableKey) => {
      keyValuePairService.get.mockResolvedValue([
        {
          key: `aiToolAvailability:${stableKey}`,
          value: { isAgentEnabled: false, isMcpEnabled: true },
        },
      ]);
      expect(
        await service.isDisabled(entry(executionRef), {
          workspaceId: 'workspace',
        }),
      ).toBe(true);
      expect(
        await service.isDisabled(entry(executionRef), {
          workspaceId: 'workspace',
          toolAvailabilityChannel: 'mcp',
        }),
      ).toBe(false);
    },
  );
  it('strips only prefixed rows in findAll', async () => {
    keyValuePairService.get.mockResolvedValue([
      ...rows,
      { key: 'foreign', value: rows[0].value },
    ]);
    expect(await service.findAll('workspace')).toEqual([
      { stableKey: 'tool:search', ...rows[0].value },
    ]);
  });
  it('deletes default availability and upserts either disabled switch', async () => {
    const scope = {
      workspaceId: 'workspace',
      userId: null,
      type: KeyValuePairType.AI_TOOL_AVAILABILITY,
      key: 'aiToolAvailability:tool:search',
    };
    await service.set('workspace', 'tool:search', {
      isAgentEnabled: true,
      isMcpEnabled: true,
    });
    expect(keyValuePairService.delete).toHaveBeenCalledWith(scope);
    expect(keyValuePairService.set).not.toHaveBeenCalled();
    for (const value of [
      { isAgentEnabled: false, isMcpEnabled: true },
      { isAgentEnabled: true, isMcpEnabled: false },
      { isAgentEnabled: false, isMcpEnabled: false },
    ]) {
      await service.set('workspace', 'tool:search', value);
      expect(keyValuePairService.set).toHaveBeenLastCalledWith({
        ...scope,
        value,
      });
    }
  });
  it('escapes LIKE metacharacters and isolates workspace core rows', async () => {
    await service.deleteByKeyPrefix('workspace', 'mcpServer:id:remote_%\\');
    expect(repository.delete).toHaveBeenCalledWith({
      workspaceId: 'workspace',
      type: KeyValuePairType.AI_TOOL_AVAILABILITY,
      userId: IsNull(),
      applicationId: IsNull(),
      key: Like(String.raw`aiToolAvailability:mcpServer:id:remote\_\%\\%`),
    });
  });
});
