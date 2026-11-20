import { SaveAndCancelButtons } from '@/settings/components/SaveAndCancelButtons/SaveAndCancelButtons';
import { useCallback, useState } from 'react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { type Editor } from '@tiptap/core';
import { isDefined } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/components/layout';
import { LightButton, LightIconButton } from 'twenty-ui/components/input';
import { Tag } from 'twenty-ui/primitives/data-display';
import { InlineBanner } from 'twenty-ui/components/feedback';
import { IconEdit, IconInfoCircle, IconRestore } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';
import { FormAdvancedTextFieldInput } from '@/advanced-text-editor/components/FormAdvancedTextFieldInput';
import { serializeAdvancedTextEditorDocument } from '@/advanced-text-editor/utils/serializeAdvancedTextEditorDocument';
import { AI_INSTRUCTIONS_EDITOR_PROFILE } from '@/ai/constants/AiInstructionsEditorProfile';
import { formatNumber } from '@/localization/utils/formatNumber';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { AI_SYSTEM_PROMPT_EDITOR_PROFILE } from '@/settings/ai/system-prompt-overrides/constants/AiSystemPromptEditorProfile';
import { SettingsAiPromptVariablePicker } from '@/settings/ai/system-prompt-overrides/components/SettingsAiPromptVariablePicker';
import { useAiSystemPromptOverrides } from '@/settings/ai/system-prompt-overrides/hooks/useAiSystemPromptOverrides';
import {
  PermissionFlagType,
  type GetAiSystemPromptOverrideSectionsQuery,
  type GetAiSystemPromptPreviewQuery,
} from '~/generated-metadata/graphql';

const StyledFormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;
const StyledActions = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFooter = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

type SettingsAiPromptSectionProps = {
  section: GetAiSystemPromptPreviewQuery['getAiSystemPromptPreview']['sections'][number];
  overrideSection?: GetAiSystemPromptOverrideSectionsQuery['aiSystemPromptOverrideSections'][number];
};

export const SettingsAiPromptSection = ({
  section,
  overrideSection,
}: SettingsAiPromptSectionProps) => {
  const { t } = useLingui();
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = useHasPermissionFlag(PermissionFlagType.AI_SETTINGS);
  const { upsert, deleteOverride, isSaving } = useAiSystemPromptOverrides();
  const [draft, setDraft] = useState('');
  const [baseline, setBaseline] = useState<string | null>(null);
  const [isResetPending, setIsResetPending] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const isCustomized = isDefined(overrideSection?.overrideContent);
  const isDirty = isDefined(baseline) && draft !== baseline;

  const handleEditorReady = useCallback(
    (editor: Editor | null) => {
      if (!isDefined(editor) || isDefined(baseline)) {
        return;
      }
      const value = serializeAdvancedTextEditorDocument(editor);

      setBaseline(value);
      setDraft(value);
    },
    [baseline],
  );

  const handleChange = (value: string) => {
    if (!isDefined(baseline)) {
      setBaseline(value);
    }
    setDraft(value);
  };

  const clearBaseline = () => {
    setBaseline(null);
    setDraft('');
  };
  const handleCancel = () => {
    clearBaseline();
    setIsResetPending(false);
    setIsEditing(false);
  };
  const handleSave = async () => {
    if (!isDefined(overrideSection)) {
      return;
    }
    const saved =
      isResetPending && !isDirty
        ? await deleteOverride(overrideSection.sectionKey)
        : await upsert(overrideSection.sectionKey, draft);

    if (saved) {
      handleCancel();
    }
  };
  const sectionTokenCount = t`~ ${formatNumber(section.estimatedTokenCount, { abbreviate: true, decimals: 1 })} tokens`;

  return (
    <Section.Root>
      <Section.Header
        title={section.title}
        description={[
          !isDefined(overrideSection) ? t`Read-only` : '',
          sectionTokenCount,
        ]
          .filter(Boolean)
          .join(' ')}
        actions={
          !isEditing ? (
            <StyledActions>
              {isCustomized && <Tag color="gray">{t`Customized`}</Tag>}
              {canEdit && isDefined(overrideSection) && (
                <LightIconButton
                  aria-label={t`Edit ${section.title}`}
                  onClick={() => {
                    clearBaseline();
                    setIsResetPending(false);
                    setIsEditing(true);
                  }}
                >
                  <IconEdit />
                </LightIconButton>
              )}
            </StyledActions>
          ) : undefined
        }
      />
      <StyledFormContainer>
        {!isEditing && overrideSection?.isDefaultChanged && (
          <InlineBanner
            icon={<IconInfoCircle />}
          >{t`The default for this section changed after it was customized. Use Reset to review the new default.`}</InlineBanner>
        )}
        {isEditing && isDefined(overrideSection) ? (
          <>
            <FormAdvancedTextFieldInput
              key={`${overrideSection.sectionKey}-${editorRevision}`}
              aria-label={section.title}
              defaultValue={
                isResetPending
                  ? overrideSection.defaultTemplate
                  : (overrideSection.overrideContent ??
                    overrideSection.defaultTemplate)
              }
              profile={AI_SYSTEM_PROMPT_EDITOR_PROFILE}
              VariablePicker={SettingsAiPromptVariablePicker}
              onEditorReady={handleEditorReady}
              onChange={handleChange}
            />
            <StyledFooter>
              {isCustomized && (
                <LightButton
                  emphasis="subtle"
                  startIcon={<IconRestore />}
                  disabled={isSaving}
                  onClick={() => {
                    clearBaseline();
                    setIsResetPending(true);
                    setEditorRevision((revision) => revision + 1);
                  }}
                >{t`Reset to default`}</LightButton>
              )}
              <SaveAndCancelButtons
                onCancel={handleCancel}
                onSave={handleSave}
                isLoading={isSaving}
                isSaveDisabled={isSaving || (!isDirty && !isResetPending)}
                isCancelDisabled={isSaving}
              />
            </StyledFooter>
          </>
        ) : (
          <FormAdvancedTextFieldInput
            key={section.content}
            aria-label={section.title}
            readonly
            defaultValue={section.content}
            profile={AI_INSTRUCTIONS_EDITOR_PROFILE}
            onChange={() => {}}
            enableFullScreen
            fullScreenBreadcrumbs={[
              { children: t`System Prompt`, href: '#' },
              { children: section.title },
            ]}
            minHeight={120}
          />
        )}
      </StyledFormContainer>
    </Section.Root>
  );
};
