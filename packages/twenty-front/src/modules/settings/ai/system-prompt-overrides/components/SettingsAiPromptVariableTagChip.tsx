import { useLingui } from '@lingui/react/macro';
import { type NodeViewProps } from '@tiptap/react';
import { isDefined } from 'twenty-shared/utils';
import { VariableChip } from '@/advanced-text-editor/extensions/variable-tag/VariableChip';
import { AI_SYSTEM_PROMPT_VARIABLES } from '@/settings/ai/system-prompt-overrides/constants/AiSystemPromptVariables';

type SettingsAiPromptVariableTagChipProps = NodeViewProps;

export const SettingsAiPromptVariableTagChip = ({
  deleteNode,
  editor,
  node,
}: SettingsAiPromptVariableTagChipProps) => {
  const { t } = useLingui();
  const variable =
    typeof node.attrs.variable === 'string' ? node.attrs.variable : '';
  const name = variable.replace(/^{{|}}$/g, '');
  const definition = AI_SYSTEM_PROMPT_VARIABLES.find(
    (entry) => entry.name === name,
  );

  return (
    <VariableChip
      deleteNode={deleteNode}
      editor={editor}
      label={isDefined(definition) ? t(definition.label) : name}
      title={variable}
    />
  );
};
