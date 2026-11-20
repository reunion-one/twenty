import { ToolCategory } from 'twenty-shared/ai';
import { ToolExecutorService } from 'src/engine/core-modules/tool-provider/services/tool-executor.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { buildToolNotAvailableOutput } from 'src/engine/core-modules/tool-provider/utils/build-tool-not-available-output.util';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';

describe('@custom ToolExecutorService availability', () => {
  it('refuses a disabled tool before resolving or invoking providers', async () => {
    const toolAvailabilityChannel = 'agents' as const;
    const descriptor: ToolIndexEntry = {
      name: 'search',
      label: 'Search',
      description: 'Search',
      category: ToolCategory.DATABASE_CRUD,
      executionRef: { kind: 'static', toolId: 'search' },
    };
    const availability = new AiToolAvailabilityService(
      {
        get: jest.fn().mockResolvedValue([
          {
            key: 'aiToolAvailability:tool:search',
            value: {
              isAgentEnabled: false,
              isMcpEnabled: true,
            },
          },
        ]),
      } as unknown as ConstructorParameters<
        typeof AiToolAvailabilityService
      >[0],
      {} as ConstructorParameters<typeof AiToolAvailabilityService>[1],
      {} as ConstructorParameters<typeof AiToolAvailabilityService>[2],
    );
    const provider = { isAvailable: jest.fn(), executeStaticTool: jest.fn() };
    const dependencies = [
      [provider],
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      availability,
    ] as unknown as ConstructorParameters<typeof ToolExecutorService>;
    const executor = new ToolExecutorService(...dependencies);
    const resolveExecutionContext = jest.fn();
    expect(
      await executor.dispatch(
        descriptor,
        {},
        {
          workspaceId: 'workspace',
          toolAvailabilityChannel,
          resolveExecutionContext,
        },
      ),
    ).toEqual(buildToolNotAvailableOutput('search'));
    expect(resolveExecutionContext).not.toHaveBeenCalled();
    expect(provider.isAvailable).not.toHaveBeenCalled();
    expect(provider.executeStaticTool).not.toHaveBeenCalled();
  });
});
