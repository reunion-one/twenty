import { isNonEmptyString } from '@sniptt/guards';
import { getValidTimeZoneOrUndefined } from 'twenty-shared/utils';
import { type UserContext } from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-actor-context.service';

export const buildUserContextVariables = (userContext?: UserContext) => {
  const timezone = getValidTimeZoneOrUndefined(userContext?.timezone);
  return {
    user: {
      firstName: userContext?.firstName ?? '',
      lastName: userContext?.lastName ?? '',
      jobTitle: isNonEmptyString(userContext?.jobTitle)
        ? userContext.jobTitle
        : 'Not set',
      locale: userContext?.locale ?? '',
      timezone: timezone ?? 'Not set',
    },
    currentDate: new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date()),
  };
};
