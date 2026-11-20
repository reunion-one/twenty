import { ToolCategory } from 'twenty-shared/ai';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';

describe('@custom ToolRegistryService availability upgrade guard', () => {
  const descriptor: ToolDescriptor = {
    name: 'search',
    label: 'Search',
    description: 'Search',
    category: ToolCategory.DATABASE_CRUD,
    executionRef: { kind: 'static', toolId: 'search' },
    inputSchema: { type: 'object' },
  };
  const keyValuePairService = {
    get: jest.fn().mockResolvedValue([
      {
        key: 'aiToolAvailability:tool:search',
        value: { isAgentEnabled: false, isMcpEnabled: true },
      },
    ]),
  };
  const availability = new AiToolAvailabilityService(
    keyValuePairService as unknown as ConstructorParameters<
      typeof AiToolAvailabilityService
    >[0],
    {} as ConstructorParameters<typeof AiToolAvailabilityService>[1],
    {} as ConstructorParameters<typeof AiToolAvailabilityService>[2],
  );
  const provider = {
    category: descriptor.category,
    isAvailable: jest.fn().mockResolvedValue(true),
    generateDescriptors: jest.fn().mockResolvedValue([descriptor]),
    executeStaticTool: jest.fn(),
  };
  const definedRegistry = {
    getAvailableDescriptors: jest.fn().mockResolvedValue([]),
    findDefinedTool: jest.fn(),
  };
  const executor = {
    dispatch: jest.fn().mockResolvedValue({ success: true, message: 'Done' }),
  };
  const registry = new ToolRegistryService(
    [provider],
    definedRegistry as unknown as ConstructorParameters<
      typeof ToolRegistryService
    >[1],
    executor as unknown as ConstructorParameters<typeof ToolRegistryService>[2],
    {} as ConstructorParameters<typeof ToolRegistryService>[3],
    {} as ConstructorParameters<typeof ToolRegistryService>[4],
    availability,
  );
  it.each([undefined, 'mcp'] as const)(
    'filters catalogs for %s',
    async (toolAvailabilityChannel) => {
      expect(
        await registry.getCatalog({
          workspaceId: 'workspace',
          toolAvailabilityChannel,
        }),
      ).toEqual(toolAvailabilityChannel === 'mcp' ? [descriptor] : []);
    },
  );
  it('preserves ToolContext channel through resolveAndExecute', async () => {
    await registry.resolveAndExecute(
      'search',
      {},
      { workspaceId: 'workspace', toolAvailabilityChannel: 'mcp' },
    );
    expect(executor.dispatch).toHaveBeenCalledWith(
      descriptor,
      {},
      expect.objectContaining({ toolAvailabilityChannel: 'mcp' }),
    );
  });
  it.each(['mcp', 'agents'] as const)(
    'preserves outer %s channel when resolving schemas',
    async (toolAvailabilityChannel) => {
      const schemas = await registry.resolveSchemas({
        toolNames: ['search'],
        context: {
          workspaceId: 'workspace',
          toolAvailabilityChannel,
          resolveExecutionContext: async () => ({ workspaceId: 'workspace' }),
        },
      });
      expect(schemas.has('search')).toBe(toolAvailabilityChannel === 'mcp');
    },
  );
  it('lists everything for an unfiltered index without reading availability', async () => {
    keyValuePairService.get.mockClear();
    expect(
      await registry.buildToolIndex('workspace', {
        toolAvailabilityChannel: 'unfiltered',
      }),
    ).toEqual([descriptor]);
    expect(keyValuePairService.get).not.toHaveBeenCalled();
  });
});
