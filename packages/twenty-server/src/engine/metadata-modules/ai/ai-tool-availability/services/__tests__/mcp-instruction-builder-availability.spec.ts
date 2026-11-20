import { ToolCategory } from 'twenty-shared/ai';

import { McpInstructionBuilderService } from 'src/engine/api/mcp/services/mcp-instruction-builder.service';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';

describe('@custom McpInstructionBuilderService availability channel upgrade guard', () => {
  it('instructions include agent-off actions and omit MCP-off actions', async () => {
    const toolMode = 'direct' as const;
    const descriptors: ToolDescriptor[] = [
      'tool_agent_off',
      'tool_mcp_off',
    ].map((name) => ({
      name,
      label: name,
      description: name,
      category: ToolCategory.ACTION,
      executionRef: { kind: 'static', toolId: name },
      inputSchema: { type: 'object' },
    }));
    const availability = new AiToolAvailabilityService(
      {
        get: async () => [
          {
            key: 'aiToolAvailability:tool:tool_agent_off',
            value: { isAgentEnabled: false, isMcpEnabled: true },
          },
          {
            key: 'aiToolAvailability:tool:tool_mcp_off',
            value: { isAgentEnabled: true, isMcpEnabled: false },
          },
        ],
      } as unknown as ConstructorParameters<
        typeof AiToolAvailabilityService
      >[0],
      {} as ConstructorParameters<typeof AiToolAvailabilityService>[1],
      {} as ConstructorParameters<typeof AiToolAvailabilityService>[2],
    );
    const registry = new ToolRegistryService(
      [
        {
          category: ToolCategory.ACTION,
          isAvailable: async () => true,
          generateDescriptors: async () => descriptors,
          executeStaticTool: jest.fn(),
        },
      ],
      {
        getAvailableDescriptors: async () => [],
        findDefinedTool: () => undefined,
      } as unknown as ConstructorParameters<typeof ToolRegistryService>[1],
      {} as ConstructorParameters<typeof ToolRegistryService>[2],
      {} as ConstructorParameters<typeof ToolRegistryService>[3],
      {} as ConstructorParameters<typeof ToolRegistryService>[4],
      availability,
    );
    const buildToolIndex = jest.spyOn(registry, 'buildToolIndex');
    const builder = new McpInstructionBuilderService(
      {
        getOrRecomputeManyOrAllFlatEntityMaps: async () => ({
          flatObjectMetadataMaps: { byUniversalIdentifier: {} },
        }),
      } as unknown as ConstructorParameters<
        typeof McpInstructionBuilderService
      >[0],
      {
        findAllFlatSkills: async () => [],
      } as unknown as ConstructorParameters<
        typeof McpInstructionBuilderService
      >[1],
      registry,
    );
    const authContext = {
      type: 'system',
      workspace: { id: 'workspace' },
    } as WorkspaceAuthContext;
    const instructions = await builder.buildInstructions({
      workspaceId: 'workspace',
      authContext,
      toolMode,
    });
    expect(buildToolIndex).toHaveBeenCalledWith('workspace', {
      authContext,
      categories: [ToolCategory.ACTION],
      toolAvailabilityChannel: 'mcp',
    });
    expect(instructions).toContain('tool_agent_off');
    expect(instructions).not.toContain('tool_mcp_off');
  });
});
