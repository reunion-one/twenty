import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { buildFieldMapsFromFlatObjectMetadata } from 'src/engine/metadata-modules/flat-field-metadata/utils/build-field-maps-from-flat-object-metadata.util';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';
import { belongsToTwentyStandardApp } from 'src/engine/metadata-modules/utils/belongs-to-twenty-standard-app.util';
import {
  WorkflowQueryValidationException,
  WorkflowQueryValidationExceptionCode,
} from 'src/modules/workflow/common/exceptions/workflow-query-validation.exception';

@Injectable()
export class WorkflowCustomFieldUpdateValidationService {
  constructor(
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
  ) {}

  async validate({
    authContext,
    objectName,
    data,
    allowedFields,
  }: {
    authContext: WorkspaceAuthContext;
    objectName: string;
    data: object;
    allowedFields: readonly string[];
  }): Promise<void> {
    // The wildcard update hook replaces updatedBy with the authenticated actor before this hook.
    const keys = Object.keys(data).filter(
      (key) => key !== 'updatedBy' && !allowedFields.includes(key),
    );

    if (keys.length === 0) {
      return;
    }

    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId: authContext.workspace.id,
          flatMapsKeys: ['flatObjectMetadataMaps', 'flatFieldMetadataMaps'],
        },
      );
    const { idByNameSingular } = buildObjectIdByNameMaps(
      flatObjectMetadataMaps,
    );
    const objectMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: idByNameSingular[objectName],
      flatEntityMaps: flatObjectMetadataMaps,
    });

    if (isDefined(objectMetadata)) {
      const { fieldIdByName, fieldIdByJoinColumnName } =
        buildFieldMapsFromFlatObjectMetadata(
          flatFieldMetadataMaps,
          objectMetadata,
        );

      if (
        keys.every((key) => {
          const field = findFlatEntityByIdInFlatEntityMaps({
            flatEntityId: fieldIdByName[key] ?? fieldIdByJoinColumnName[key],
            flatEntityMaps: flatFieldMetadataMaps,
          });

          return (
            isDefined(field) &&
            !field.isSystem &&
            !field.isSystemSideEffect &&
            !belongsToTwentyStandardApp(field)
          );
        })
      ) {
        return;
      }
    }

    throw new WorkflowQueryValidationException(
      'Method not allowed.',
      WorkflowQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
