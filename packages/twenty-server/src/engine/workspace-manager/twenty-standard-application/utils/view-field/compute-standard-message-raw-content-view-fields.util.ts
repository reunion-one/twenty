import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import {
  createStandardViewFieldFlatMetadata,
  type CreateStandardViewFieldArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view-field/create-standard-view-field-flat-metadata.util';

export const computeStandardMessageRawContentViewFields = (
  args: Omit<CreateStandardViewFieldArgs<'messageRawContent'>, 'context'>,
): Record<string, FlatViewField> => {
  return {
    allMessageRawContentsMessage: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'messageRawContent',
      context: {
        viewName: 'allMessageRawContents',
        viewFieldName: 'message',
        fieldName: 'message',
        position: 0,
        isVisible: true,
        size: 150,
      },
    }),
    allMessageRawContentsMessageChannelMessageAssociation:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'allMessageRawContents',
          viewFieldName: 'messageChannelMessageAssociation',
          fieldName: 'messageChannelMessageAssociation',
          position: 1,
          isVisible: true,
          size: 150,
        },
      }),
    allMessageRawContentsProvider: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'messageRawContent',
      context: {
        viewName: 'allMessageRawContents',
        viewFieldName: 'provider',
        fieldName: 'provider',
        position: 2,
        isVisible: true,
        size: 150,
      },
    }),
    allMessageRawContentsContentFormat: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'messageRawContent',
      context: {
        viewName: 'allMessageRawContents',
        viewFieldName: 'contentFormat',
        fieldName: 'contentFormat',
        position: 3,
        isVisible: true,
        size: 150,
      },
    }),
    allMessageRawContentsRawContent: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'messageRawContent',
      context: {
        viewName: 'allMessageRawContents',
        viewFieldName: 'rawContent',
        fieldName: 'rawContent',
        position: 4,
        isVisible: true,
        size: 150,
      },
    }),
    allMessageRawContentsMetadata: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'messageRawContent',
      context: {
        viewName: 'allMessageRawContents',
        viewFieldName: 'metadata',
        fieldName: 'metadata',
        position: 5,
        isVisible: true,
        size: 150,
      },
    }),
    allMessageRawContentsUpdatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'messageRawContent',
      context: {
        viewName: 'allMessageRawContents',
        viewFieldName: 'updatedAt',
        fieldName: 'updatedAt',
        position: 6,
        isVisible: true,
        size: 150,
      },
    }),
    allMessageRawContentsCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'messageRawContent',
      context: {
        viewName: 'allMessageRawContents',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 7,
        isVisible: true,
        size: 150,
      },
    }),

    messageRawContentRecordPageFieldsMessage:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'message',
          fieldName: 'message',
          position: 0,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'general',
        },
      }),
    messageRawContentRecordPageFieldsMessageChannelMessageAssociation:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'messageChannelMessageAssociation',
          fieldName: 'messageChannelMessageAssociation',
          position: 1,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'general',
        },
      }),
    messageRawContentRecordPageFieldsProvider:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'provider',
          fieldName: 'provider',
          position: 2,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'general',
        },
      }),
    messageRawContentRecordPageFieldsContentFormat:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'contentFormat',
          fieldName: 'contentFormat',
          position: 3,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'general',
        },
      }),
    messageRawContentRecordPageFieldsRawContent:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'rawContent',
          fieldName: 'rawContent',
          position: 4,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'general',
        },
      }),
    messageRawContentRecordPageFieldsMetadata:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'metadata',
          fieldName: 'metadata',
          position: 5,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'general',
        },
      }),
    messageRawContentRecordPageFieldsCreatedAt:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'createdAt',
          fieldName: 'createdAt',
          position: 0,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'system',
        },
      }),
    messageRawContentRecordPageFieldsUpdatedAt:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'updatedAt',
          fieldName: 'updatedAt',
          position: 1,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'system',
        },
      }),
    messageRawContentRecordPageFieldsCreatedBy:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'messageRawContent',
        context: {
          viewName: 'messageRawContentRecordPageFields',
          viewFieldName: 'createdBy',
          fieldName: 'createdBy',
          position: 2,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'system',
        },
      }),
  };
};
