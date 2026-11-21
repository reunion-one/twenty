import { msg } from '@lingui/core/macro';
import { AI_SYSTEM_PROMPT_OVERRIDE_KEY_PREFIX } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-override-key-prefix.constant';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { doNotTranslate } from 'twenty-shared/i18n';
import { isDefined, tipTapDocumentToMarkdown } from 'twenty-shared/utils';
import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { KeyValuePairType } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';
import { type BuildSystemPromptArguments } from 'src/engine/metadata-modules/ai/ai-chat/types/build-system-prompt-arguments.type';
import { buildSystemPromptSections } from 'src/engine/metadata-modules/ai/ai-chat/utils/build-system-prompt-sections.util';
import {
  AI_SYSTEM_PROMPT_EDITABLE_SECTIONS,
  type AiSystemPromptSectionKey,
} from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-editable-sections.constant';
import { AI_SYSTEM_PROMPT_VARIABLE_NAMES } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/constants/ai-system-prompt-variable-names.constant';
import {
  type AiSystemPromptOverride,
  type AiSystemPromptOverrideValueMap,
} from 'src/engine/metadata-modules/ai/ai-system-prompt-override/types/ai-system-prompt-override.type';
import { applyAiSystemPromptOverrides } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/apply-ai-system-prompt-overrides.util';
import { type AiSystemPromptToolNames } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/build-ai-system-prompt-catalog-variables.util';
import { buildAiSystemPromptVariableContext } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/build-ai-system-prompt-variable-context.util';
import { extractTemplateVariableNames } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/extract-template-variable-names.util';
import { getAiSystemPromptDefaultTemplates } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/get-ai-system-prompt-default-templates.util';
import { unescapeMarkdownText } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/utils/unescape-markdown-text.util';

@Injectable()
export class AiSystemPromptOverrideService {
  constructor(
    private readonly keyValuePairService: KeyValuePairService<AiSystemPromptOverrideValueMap>,
  ) {}

  async findOverrides(
    workspaceId: string,
  ): Promise<Map<AiSystemPromptSectionKey, AiSystemPromptOverride>> {
    // shortcut: one indexed query per chat step; cache per workspace if it shows in traces.
    const rows = await this.keyValuePairService.get({
      workspaceId,
      userId: null,
      type: KeyValuePairType.AI_SYSTEM_PROMPT_OVERRIDE,
    });

    return new Map(
      rows
        .filter((row) =>
          row.key.startsWith(AI_SYSTEM_PROMPT_OVERRIDE_KEY_PREFIX),
        )
        .map(
          (row) =>
            [
              row.key.slice(AI_SYSTEM_PROMPT_OVERRIDE_KEY_PREFIX.length),
              row.value,
            ] as const,
        )
        .filter(([sectionKey]) =>
          Object.prototype.hasOwnProperty.call(
            AI_SYSTEM_PROMPT_EDITABLE_SECTIONS,
            sectionKey,
          ),
        )
        .map(([sectionKey, value]) => [
          sectionKey as AiSystemPromptSectionKey,
          value,
        ]),
    );
  }

  async buildSections(
    args: BuildSystemPromptArguments,
    workspaceName?: string | null,
    toolNames?: AiSystemPromptToolNames,
  ) {
    const sections = buildSystemPromptSections(args);
    const context = buildAiSystemPromptVariableContext(
      args,
      sections,
      workspaceName,
      toolNames,
    );

    return applyAiSystemPromptOverrides(
      sections,
      await this.findOverrides(args.workspaceId),
      context,
    );
  }

  async buildFullSystemPrompt(
    args: BuildSystemPromptArguments,
    workspaceName?: string | null,
    toolNames?: AiSystemPromptToolNames,
  ) {
    return (await this.buildSections(args, workspaceName, toolNames))
      .map((section) => section.content)
      .join('\n');
  }

  async listSettingsSections(workspaceId: string) {
    const overrides = await this.findOverrides(workspaceId);
    const templates = getAiSystemPromptDefaultTemplates();

    return (
      Object.keys(
        AI_SYSTEM_PROMPT_EDITABLE_SECTIONS,
      ) as AiSystemPromptSectionKey[]
    ).map((sectionKey) => {
      const override = overrides.get(sectionKey);
      const defaultTemplate = templates[sectionKey];

      return {
        sectionKey,
        title: AI_SYSTEM_PROMPT_EDITABLE_SECTIONS[sectionKey],
        defaultTemplate,
        overrideContent: override?.content ?? null,
        isDefaultChanged:
          isDefined(override) &&
          override.defaultHash !== this.hash(defaultTemplate),
      };
    });
  }

  async upsert(workspaceId: string, sectionKey: string, content: string) {
    this.assertSectionKey(sectionKey);

    const unknownVariables = extractTemplateVariableNames(
      unescapeMarkdownText(tipTapDocumentToMarkdown(content)),
    ).filter((name) => !AI_SYSTEM_PROMPT_VARIABLE_NAMES.includes(name));

    if (unknownVariables.length > 0) {
      const names = unknownVariables.join(', ');

      throw new UserInputError(
        doNotTranslate(`Unknown system prompt variables: ${names}`),
        { userFriendlyMessage: msg`Unknown variables: ${names}` },
      );
    }

    const key = sectionKey;

    return this.keyValuePairService.set({
      workspaceId,
      userId: null,
      type: KeyValuePairType.AI_SYSTEM_PROMPT_OVERRIDE,
      key: `${AI_SYSTEM_PROMPT_OVERRIDE_KEY_PREFIX}${key}`,
      value: {
        content,
        defaultHash: this.hash(getAiSystemPromptDefaultTemplates()[key]),
      },
    });
  }

  async delete(workspaceId: string, sectionKey: string) {
    this.assertSectionKey(sectionKey);

    return this.keyValuePairService.delete({
      workspaceId,
      userId: null,
      type: KeyValuePairType.AI_SYSTEM_PROMPT_OVERRIDE,
      key: `${AI_SYSTEM_PROMPT_OVERRIDE_KEY_PREFIX}${sectionKey}`,
    });
  }

  private assertSectionKey(
    sectionKey: string,
  ): asserts sectionKey is AiSystemPromptSectionKey {
    if (
      !Object.prototype.hasOwnProperty.call(
        AI_SYSTEM_PROMPT_EDITABLE_SECTIONS,
        sectionKey,
      )
    ) {
      throw new UserInputError(
        doNotTranslate(`Unknown system prompt section: ${sectionKey}`),
      );
    }
  }

  private hash(template: string) {
    return createHash('sha256').update(template).digest('hex');
  }
}
