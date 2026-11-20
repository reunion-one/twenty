import { type ActorMetadata } from 'twenty-shared/types';
import { type APP_LOCALES } from 'twenty-shared/translations';

import { type CodeExecutionStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/code-execution-stream-emitter.type';

import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

import { type AiToolAvailabilityChannel } from 'src/engine/metadata-modules/ai/ai-tool-availability/types/ai-tool-availability-channel.type';

export type ToolContext = {
  resolveExecutionContext?: () => Promise<ToolContext>;
  workspaceId: string;
  toolAvailabilityChannel?: AiToolAvailabilityChannel;
  approvedToolName?: string;
  authContext?: WorkspaceAuthContext;
  application?: FlatApplication;
  actorMetadata?: ActorMetadata;
  userId?: string;
  userWorkspaceId?: string;
  agentId?: string;
  threadId?: string;
  locale?: keyof typeof APP_LOCALES;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
};
