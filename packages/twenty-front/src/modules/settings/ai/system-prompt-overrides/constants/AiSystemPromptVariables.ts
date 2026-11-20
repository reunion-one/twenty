import { msg } from '@lingui/core/macro';

export const AI_SYSTEM_PROMPT_VARIABLES = [
  {
    name: 'assistant.displayName',
    description: msg`The assistant display name for this workspace, or the default assistant name when none is set.`,
    label: msg`Display name`,
    group: msg`Assistant`,
  },
  {
    name: 'user.firstName',
    description: msg`The first name of the user making the request. Empty when unavailable.`,
    label: msg`First name`,
    group: msg`User`,
  },
  {
    name: 'user.lastName',
    description: msg`The last name of the user making the request. Empty when unavailable.`,
    label: msg`Last name`,
    group: msg`User`,
  },
  {
    name: 'user.jobTitle',
    description: msg`The job title from the current user profile. Empty when no job title is set.`,
    label: msg`Job title`,
    group: msg`User`,
  },
  {
    name: 'user.locale',
    description: msg`The locale code from the current user profile, such as en-US.`,
    label: msg`Locale`,
    group: msg`User`,
  },
  {
    name: 'user.timezone',
    description: msg`The timezone from the current user profile, such as Europe/Paris. Empty when no timezone is set.`,
    label: msg`Timezone`,
    group: msg`User`,
  },
  {
    name: 'user.userWorkspaceId',
    description: msg`The ID of the current user's membership in this workspace.`,
    label: msg`Workspace membership ID`,
    group: msg`User`,
  },
  {
    name: 'workspace.name',
    description: msg`The display name of the workspace where the request is made.`,
    label: msg`Workspace name`,
    group: msg`Workspace`,
  },
  {
    name: 'workspace.id',
    description: msg`The unique ID of the workspace where the request is made.`,
    label: msg`Workspace ID`,
    group: msg`Workspace`,
  },
  {
    name: 'currentDate',
    description: msg`The current date in English with the full weekday, month, day and year. Uses the user timezone, or the server timezone when unavailable or invalid.`,
    label: msg`Current date`,
    group: msg`Date`,
  },
  {
    name: 'toolCatalog',
    description: msg`The generated catalog of tools available for this request, grouped by category, including tool names and usage guidance.`,
    label: msg`Tool catalog`,
    group: msg`Generated blocks`,
  },
  {
    name: 'skillCatalog',
    description: msg`The generated list of available skills, with their names, descriptions and instructions for loading them. Empty when no skills are available.`,
    label: msg`Skill catalog`,
    group: msg`Generated blocks`,
  },
  {
    name: 'userContext',
    description: msg`The generated user context with the user name, job title, locale, timezone and current date. Empty when the request has no user context.`,
    label: msg`User context`,
    group: msg`Generated blocks`,
  },
];
