import { assertUnreachable, isDefined } from 'twenty-shared/utils';
import { type ToolExecutionRef } from 'src/engine/core-modules/tool-provider/types/tool-execution-ref.type';

export const getAiToolAvailabilityKey = (
  executionRef: ToolExecutionRef,
  objectIdByNameSingular: Record<string, string>,
): string | undefined => {
  switch (executionRef.kind) {
    case 'static':
      return `tool:${executionRef.toolId}`;
    case 'logic_function':
      return `logicFunction:${executionRef.logicFunctionId}`;
    case 'database_crud': {
      const objectId = objectIdByNameSingular[executionRef.objectNameSingular];
      return isDefined(objectId)
        ? `object:${objectId}:${executionRef.operation}`
        : undefined;
    }
    case 'mcp_server_tool':
      return `mcpServer:${executionRef.mcpServerId}:${executionRef.toolName}`;
    default:
      return assertUnreachable(executionRef);
  }
};
