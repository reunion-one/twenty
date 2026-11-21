import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';
import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { KeyValuePairService } from 'src/engine/core-modules/key-value-pair/key-value-pair.service';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';
import { AI_TOOL_AVAILABILITY_KEY_PREFIX } from 'src/engine/metadata-modules/ai/ai-tool-availability/constants/ai-tool-availability-key-prefix.constant';
import {
  type AiToolAvailability,
  type AiToolAvailabilityValueMap,
} from 'src/engine/metadata-modules/ai/ai-tool-availability/types/ai-tool-availability.type';
import { getAiToolAvailabilityKey } from 'src/engine/metadata-modules/ai/ai-tool-availability/utils/get-ai-tool-availability-key.util';

@Injectable()
export class AiToolAvailabilityService {
  constructor(
    private readonly keyValuePairService: KeyValuePairService<AiToolAvailabilityValueMap>,
    @InjectRepository(KeyValuePairEntity)
    private readonly keyValuePairRepository: Repository<KeyValuePairEntity>,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  async filterCatalog<TEntry extends ToolIndexEntry | ToolDescriptor>(
    context: ToolProviderContext,
    entries: TEntry[],
  ): Promise<TEntry[]> {
    const isDisabled = await this.buildDisabledPredicate(context);
    return isDefined(isDisabled)
      ? entries.filter((entry) => !isDisabled(entry))
      : entries;
  }

  async isDisabled(
    descriptor: ToolIndexEntry | ToolDescriptor,
    context: ToolProviderContext,
  ): Promise<boolean> {
    return (await this.buildDisabledPredicate(context))?.(descriptor) ?? false;
  }

  async getStableKeysByToolName(
    workspaceId: string,
    catalog: ToolIndexEntry[],
  ): Promise<Map<string, string | undefined>> {
    const objectIdByNameSingular = catalog.some(
      (entry) => entry.executionRef.kind === 'database_crud',
    )
      ? await this.getObjectIdByNameSingular(workspaceId)
      : {};

    return new Map(
      catalog.map((entry) => [
        entry.name,
        getAiToolAvailabilityKey(entry.executionRef, objectIdByNameSingular),
      ]),
    );
  }

  async findAll(
    workspaceId: string,
  ): Promise<Array<AiToolAvailability & { stableKey: string }>> {
    // shortcut: one indexed query per catalog build; cache per workspace if it shows in traces.
    const rows = await this.keyValuePairService.get({
      workspaceId,
      userId: null,
      type: KeyValuePairType.AI_TOOL_AVAILABILITY,
    });
    return rows
      .filter((row) => row.key.startsWith(AI_TOOL_AVAILABILITY_KEY_PREFIX))
      .map((row) => ({
        stableKey: row.key.slice(AI_TOOL_AVAILABILITY_KEY_PREFIX.length),
        ...row.value,
      }));
  }

  async set(
    workspaceId: string,
    stableKey: string,
    availability: AiToolAvailability,
  ): Promise<void> {
    return this.setMany(workspaceId, [{ stableKey, availability }]);
  }

  async setMany(
    workspaceId: string,
    entries: Array<{ stableKey: string; availability: AiToolAvailability }>,
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const queryRunner =
      this.keyValuePairRepository.manager.connection.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      for (const { stableKey, availability } of entries) {
        const scope = {
          workspaceId,
          userId: null,
          type: KeyValuePairType.AI_TOOL_AVAILABILITY,
          key: `${AI_TOOL_AVAILABILITY_KEY_PREFIX}${stableKey}` as const,
        };
        if (availability.isAgentEnabled && availability.isMcpEnabled) {
          await this.keyValuePairService.delete(scope, queryRunner);
        } else {
          await this.keyValuePairService.set(
            { ...scope, value: availability },
            queryRunner,
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteByKeyPrefix(
    workspaceId: string,
    stableKeyPrefix: string,
  ): Promise<void> {
    const escapedPrefix =
      `${AI_TOOL_AVAILABILITY_KEY_PREFIX}${stableKeyPrefix}`.replace(
        /[\\%_]/g,
        '\\$&',
      );
    await this.keyValuePairRepository.delete({
      workspaceId,
      userId: IsNull(),
      applicationId: IsNull(),
      type: KeyValuePairType.AI_TOOL_AVAILABILITY,
      key: Like(`${escapedPrefix}%`),
    });
  }

  private async getObjectIdByNameSingular(
    workspaceId: string,
  ): Promise<Record<string, string>> {
    const { flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
      ]);

    return buildObjectIdByNameMaps(flatObjectMetadataMaps).idByNameSingular;
  }

  private async buildDisabledPredicate(
    context: ToolProviderContext,
  ): Promise<
    ((entry: ToolIndexEntry | ToolDescriptor) => boolean) | undefined
  > {
    const channel = context.toolAvailabilityChannel ?? 'agents';
    if (channel === 'unfiltered') {
      return undefined;
    }
    const rows = await this.findAll(context.workspaceId);
    if (rows.length === 0) {
      return undefined;
    }
    let objectIdByNameSingular: Record<string, string> = {};
    if (rows.some((row) => row.stableKey.startsWith('object:'))) {
      objectIdByNameSingular = await this.getObjectIdByNameSingular(
        context.workspaceId,
      );
    }
    const availabilityByKey = new Map(rows.map((row) => [row.stableKey, row]));
    return (entry) => {
      const key = getAiToolAvailabilityKey(
        entry.executionRef,
        objectIdByNameSingular,
      );
      const availability = isDefined(key)
        ? availabilityByKey.get(key)
        : undefined;
      return (
        (channel === 'agents'
          ? availability?.isAgentEnabled
          : availability?.isMcpEnabled) === false
      );
    };
  }
}
