import { getAiToolAvailabilityKey } from 'src/engine/metadata-modules/ai/ai-tool-availability/utils/get-ai-tool-availability-key.util';
import { type ToolExecutionRef } from 'src/engine/core-modules/tool-provider/types/tool-execution-ref.type';

describe('@custom getAiToolAvailabilityKey', () => {
  it.each<[ToolExecutionRef, string]>([
    [{ kind: 'static', toolId: 'search' }, 'tool:search'],
    [
      { kind: 'logic_function', logicFunctionId: 'function' },
      'logicFunction:function',
    ],
    [
      {
        kind: 'database_crud',
        objectNameSingular: 'person',
        operation: 'find_many',
      },
      'object:object-id:find_many',
    ],
    [
      {
        kind: 'mcp_server_tool',
        mcpServerId: 'server',
        toolName: 'remote_tool',
      },
      'mcpServer:server:remote_tool',
    ],
  ])('builds the key for %j', (executionRef, expected) => {
    expect(
      getAiToolAvailabilityKey(executionRef, { person: 'object-id' }),
    ).toBe(expected);
  });
  it('keeps record identity through an object rename and keeps missing objects unresolved', () => {
    const executionRef = {
      kind: 'database_crud',
      objectNameSingular: 'person',
      operation: 'find_many',
    } as const;
    expect(getAiToolAvailabilityKey(executionRef, { person: 'id' })).toBe(
      getAiToolAvailabilityKey(
        { ...executionRef, objectNameSingular: 'contact' },
        { contact: 'id' },
      ),
    );
    expect(getAiToolAvailabilityKey(executionRef, {})).toBeUndefined();
  });
});
