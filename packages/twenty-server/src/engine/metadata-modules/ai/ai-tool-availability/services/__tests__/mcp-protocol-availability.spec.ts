import { ToolCategory } from 'twenty-shared/ai';

import { McpProtocolService } from 'src/engine/api/mcp/services/mcp-protocol.service';
import { McpToolExecutorService } from 'src/engine/api/mcp/services/mcp-tool-executor.service';
import { type McpCoreQueryContext } from 'src/engine/api/mcp/types/mcp-core-query-context.type';
import { type McpToolCallResult } from 'src/engine/api/mcp/types/mcp-tool-call-result.type';
import { COMMON_PRELOAD_TOOLS } from 'src/engine/core-modules/tool-provider/constants/common-preload-tools.const';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type LearnToolsResult } from 'src/engine/core-modules/tool-provider/tools/learn-tools.tool';
import { type GetToolCatalogResult } from 'src/engine/core-modules/tool-provider/tools/get-tool-catalog.tool';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';

describe('@custom McpProtocolService availability channel upgrade guard', () => {
  const staticDescriptor = (name: string): ToolDescriptor => ({
    name,
    label: name,
    description: `Description of ${name}`,
    category: ToolCategory.ACTION,
    executionRef: { kind: 'static', toolId: name },
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
  });
  const preloadedName = COMMON_PRELOAD_TOOLS[0];
  const descriptors: ToolDescriptor[] = [
    ...['tool_both', 'tool_agent_off', 'tool_mcp_off', preloadedName].map(
      staticDescriptor,
    ),
    {
      name: 'find_many_people',
      label: 'Find people',
      description: 'Find people',
      category: ToolCategory.DATABASE_CRUD,
      objectName: 'person',
      operation: 'find_many',
      executionRef: {
        kind: 'database_crud',
        objectNameSingular: 'person',
        operation: 'find_many',
      },
      inputSchema: { type: 'object' },
    },
  ];
  const keyValuePairService = { get: jest.fn() };
  const workspaceCacheService = { getOrRecompute: jest.fn() };
  const availability = new AiToolAvailabilityService(
    keyValuePairService as unknown as ConstructorParameters<
      typeof AiToolAvailabilityService
    >[0],
    {} as ConstructorParameters<typeof AiToolAvailabilityService>[1],
    workspaceCacheService as unknown as ConstructorParameters<
      typeof AiToolAvailabilityService
    >[2],
  );
  const executor = { dispatch: jest.fn() };
  const exceptionHandler = { captureExceptions: jest.fn() };
  const registry = new ToolRegistryService(
    [ToolCategory.ACTION, ToolCategory.DATABASE_CRUD].map((category) => ({
      category,
      isAvailable: async () => true,
      generateDescriptors: async () =>
        descriptors.filter((descriptor) => descriptor.category === category),
      executeStaticTool: jest.fn(),
    })),
    {
      getAvailableDescriptors: async () => [],
      findDefinedTool: () => undefined,
    } as unknown as ConstructorParameters<typeof ToolRegistryService>[1],
    executor as unknown as ConstructorParameters<typeof ToolRegistryService>[2],
    {
      spillIfTooLarge: async (output: unknown) => output,
    } as unknown as ConstructorParameters<typeof ToolRegistryService>[3],
    exceptionHandler as unknown as ConstructorParameters<
      typeof ToolRegistryService
    >[4],
    availability,
  );
  const metrics = { recordHistogram: jest.fn(), incrementCounterBy: jest.fn() };
  const protocol = new McpProtocolService(
    registry,
    new McpToolExecutorService(
      metrics as unknown as ConstructorParameters<
        typeof McpToolExecutorService
      >[0],
    ),
    {} as ConstructorParameters<typeof McpProtocolService>[2],
    {} as ConstructorParameters<typeof McpProtocolService>[3],
    {} as ConstructorParameters<typeof McpProtocolService>[4],
    workspaceCacheService as unknown as ConstructorParameters<
      typeof McpProtocolService
    >[5],
    exceptionHandler as unknown as ConstructorParameters<
      typeof McpProtocolService
    >[6],
  );
  const workspace = { id: 'workspace' } as McpCoreQueryContext['workspace'];
  const query = (
    toolMode: McpCoreQueryContext['toolMode'],
    method: string,
    params?: Record<string, unknown>,
  ) =>
    protocol.handleMCPCoreQuery(
      { jsonrpc: '2.0', id: 1, method, params },
      {
        workspace,
        authContext: { type: 'system', workspace },
        toolMode,
        apiKey: undefined,
        agentId: undefined,
      },
    );
  const call = (
    toolMode: McpCoreQueryContext['toolMode'],
    name: string,
    toolArguments: Record<string, unknown> = {},
  ) => query(toolMode, 'tools/call', { name, arguments: toolArguments });
  const toolResult = <TData>(
    response: Record<string, unknown> | null,
  ): TData => {
    expect(response).not.toHaveProperty('error');
    const result = response?.result as McpToolCallResult;
    return JSON.parse(result.content[0].text) as TData;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    keyValuePairService.get.mockResolvedValue([
      {
        key: 'aiToolAvailability:tool:tool_agent_off',
        value: { isAgentEnabled: false, isMcpEnabled: true },
      },
      {
        key: 'aiToolAvailability:tool:tool_mcp_off',
        value: { isAgentEnabled: true, isMcpEnabled: false },
      },
    ]);
    executor.dispatch.mockResolvedValue({ success: true, message: 'Done' });
    workspaceCacheService.getOrRecompute.mockResolvedValue({
      flatObjectMetadataMaps: {
        byUniversalIdentifier: {
          person: {
            id: 'object-id',
            nameSingular: 'person',
            namePlural: 'people',
          },
        },
      },
    });
  });

  it('direct tools/list never exposes an MCP-off tool', async () => {
    const response = await query('direct', 'tools/list');
    expect(response).not.toHaveProperty('error');
    const { tools } = response?.result as { tools: Array<{ name: string }> };
    const names = tools.map(({ name }) => name);
    expect(names).not.toContain('tool_mcp_off');
    expect(names).toEqual(
      expect.arrayContaining(['tool_agent_off', 'tool_both', preloadedName]),
    );
  });

  it('direct named call refuses an MCP-off tool', async () => {
    expect(await call('direct', 'tool_mcp_off')).toMatchObject({
      result: { isError: true },
    });
    expect(executor.dispatch).not.toHaveBeenCalled();
  });

  it('execute_tool refuses an MCP-off tool', async () => {
    expect(
      await call('meta', 'execute_tool', {
        toolName: 'tool_mcp_off',
        arguments: {},
      }),
    ).toMatchObject({ result: { isError: true } });
    expect(executor.dispatch).not.toHaveBeenCalled();
  });

  it('execute_tool executes an agent-off tool with the MCP channel', async () => {
    expect(
      await call('meta', 'execute_tool', {
        toolName: 'tool_agent_off',
        arguments: { query: 'hello' },
      }),
    ).toMatchObject({ result: { isError: false } });
    expect(executor.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'tool_agent_off' }),
      { query: 'hello' },
      expect.objectContaining({ toolAvailabilityChannel: 'mcp' }),
    );
  });

  it('preloaded call carries the MCP channel', async () => {
    expect(await call('direct', preloadedName)).toMatchObject({
      result: { isError: false },
    });
    expect(executor.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: preloadedName }),
      {},
      expect.objectContaining({ toolAvailabilityChannel: 'mcp' }),
    );
  });

  it('learn_tools exposes only MCP-enabled tools', async () => {
    const learned = toolResult<LearnToolsResult>(
      await call('meta', 'learn_tools', {
        toolNames: ['tool_agent_off', 'tool_mcp_off'],
        aspects: ['description'],
      }),
    );
    expect(learned.tools.map(({ name }) => name)).toEqual(['tool_agent_off']);
    expect(learned.notFound).toContain('tool_mcp_off');
  });

  it('get_tool_catalog uses MCP availability on its own context', async () => {
    const result = toolResult<GetToolCatalogResult>(
      await call('meta', 'get_tool_catalog'),
    );
    const names = Object.values(result.catalog)
      .flat()
      .map(({ name }) => name);
    expect(names).toContain('tool_agent_off');
    expect(names).not.toContain('tool_mcp_off');
  });

  it('generic find_records refuses an MCP-off object operation', async () => {
    keyValuePairService.get.mockResolvedValue([
      {
        key: 'aiToolAvailability:object:object-id:find_many',
        value: { isAgentEnabled: true, isMcpEnabled: false },
      },
    ]);
    expect(
      await call('generic', 'find_records', {
        objectName: 'person',
        filter: {},
        select: ['id'],
      }),
    ).toMatchObject({ result: { isError: true } });
    expect(executor.dispatch).not.toHaveBeenCalled();
    expect(workspaceCacheService.getOrRecompute).toHaveBeenCalledWith(
      'workspace',
      ['flatObjectMetadataMaps'],
    );
    keyValuePairService.get.mockResolvedValue([]);
    expect(
      toolResult(
        await call('generic', 'find_records', {
          objectName: 'person',
          filter: {},
          select: ['id'],
        }),
      ),
    ).toEqual({ success: true, message: 'Done' });
    expect(executor.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'find_many_people' }),
      expect.objectContaining({ select: ['id'] }),
      expect.objectContaining({ toolAvailabilityChannel: 'mcp' }),
    );
  });
});
