import { resolveStringTemplate } from 'twenty-shared/utils';
import { type UserContext } from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-actor-context.service';
import { USER_CONTEXT_TEMPLATE } from 'src/engine/metadata-modules/ai/ai-chat/constants/user-context-prompt-template.constant';
import { buildUserContextVariables } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-user-context-variables.util';

export const buildUserContextSection = (userContext: UserContext): string =>
  resolveStringTemplate(
    USER_CONTEXT_TEMPLATE,
    buildUserContextVariables(userContext),
  );
