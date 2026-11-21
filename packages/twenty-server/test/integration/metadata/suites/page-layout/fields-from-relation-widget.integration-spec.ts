import { z } from 'zod';
import { findManyObjectMetadata } from 'test/integration/metadata/suites/object-metadata/utils/find-many-object-metadata.util';
import { createOnePageLayout } from 'test/integration/metadata/suites/page-layout/utils/create-one-page-layout.util';
import { destroyOnePageLayout } from 'test/integration/metadata/suites/page-layout/utils/destroy-one-page-layout.util';
import { findOnePageLayout } from 'test/integration/metadata/suites/page-layout/utils/find-one-page-layout.util';
import { updateOnePageLayoutWithTabsAndWidgets } from 'test/integration/metadata/suites/page-layout/utils/update-one-page-layout-with-tabs-and-widgets.util';
import { createOneView } from 'test/integration/metadata/suites/view/utils/create-one-view.util';
import { upsertFieldsWidget } from 'test/integration/metadata/suites/view-field-group/utils/upsert-fields-widget.util';
import {
  PageLayoutType,
  PageLayoutTabLayoutMode,
  ViewType,
  WidgetType,
} from 'twenty-shared/types';
import { v4 } from 'uuid';
import { WidgetConfigurationType } from 'src/engine/metadata-modules/page-layout-widget/enums/widget-configuration-type.type';

const layoutFields = `id tabs { id widgets { id objectMetadataId configuration { ... on FieldsFromRelationConfiguration { viewId relationFieldMetadataId isReadOnly } } } }`;

describe('Fields from relation widget @custom', () => {
  let layoutId: string;
  let personId: string;
  let companyId: string;
  let companyFieldId: string;
  let peopleFieldId: string;
  let selectedFieldId: string;
  let tabId: string;
  let widgetId: string;
  let viewId: string;

  beforeAll(async () => {
    const { objects } = await findManyObjectMetadata({
      input: { filter: {}, paging: { first: 100 } },
      gqlFields: 'id nameSingular fieldsList { id name }',
      expectToFail: false,
    });
    const person = objects.find((object) => object.nameSingular === 'person');
    const company = objects.find((object) => object.nameSingular === 'company');
    if (!person || !company) {
      throw new Error('Seeded objects missing');
    }
    personId = person.id;
    companyId = company.id;
    companyFieldId = person.fieldsList!.find(
      (field) => field.name === 'company',
    )!.id;
    peopleFieldId = company.fieldsList!.find(
      (field) => field.name === 'people',
    )!.id;
    selectedFieldId = company.fieldsList!.find(
      (field) => field.name === 'employees',
    )!.id;
    const layout = await createOnePageLayout({
      input: {
        name: 'Fields from relation test',
        type: PageLayoutType.RECORD_PAGE,
        objectMetadataId: personId,
      },
      expectToFail: false,
    });
    layoutId = layout.data.createPageLayout.id;
    tabId = v4();
    widgetId = v4();
    viewId = v4();
    const view = await createOneView({
      input: {
        id: viewId,
        name: 'Company fields from relation',
        icon: 'IconListDetails',
        objectMetadataId: companyId,
        type: ViewType.FIELDS_WIDGET,
      },
      expectToFail: false,
    });
    expect(view.errors).toBeUndefined();
  });

  afterAll(async () => {
    if (layoutId) {
      await destroyOnePageLayout({
        input: { id: layoutId },
        expectToFail: false,
      });
    }
  });

  const save = (
    relationFieldMetadataId: string,
    objectMetadataId = companyId,
    nextViewId = viewId,
    expectToFail = false,
    isReadOnly = false,
  ) =>
    updateOnePageLayoutWithTabsAndWidgets({
      input: {
        id: layoutId,
        name: 'Fields from relation test',
        type: PageLayoutType.RECORD_PAGE,
        objectMetadataId: personId,
        tabs: [
          {
            id: tabId,
            title: 'Home',
            position: 0,
            layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
            widgets: [
              {
                id: widgetId,
                pageLayoutTabId: tabId,
                title: 'Company fields',
                type: WidgetType.FIELDS_FROM_RELATION,
                objectMetadataId,
                position: {
                  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
                  index: 0,
                },
                configuration: {
                  configurationType:
                    WidgetConfigurationType.FIELDS_FROM_RELATION,
                  newFieldDefaultVisibility: false,
                  isReadOnly,
                  relationFieldMetadataId,
                  viewId: nextViewId,
                },
              },
            ],
          },
        ],
      },
      gqlFields: layoutFields,
      expectToFail,
    });

  it('saves a single-record relation and reloads selected target fields', async () => {
    const saved = await save(companyFieldId);
    expect(saved.errors).toBeUndefined();
    const selected = await upsertFieldsWidget({
      input: {
        widgetId,
        fields: [
          { fieldMetadataId: selectedFieldId, position: 0, isVisible: true },
        ],
      },
      gqlFields: 'id objectMetadataId viewFields { fieldMetadataId isVisible }',
      expectToFail: false,
    });
    expect(selected.errors).toBeUndefined();
    expect(selected.data.upsertFieldsWidget.objectMetadataId).toBe(companyId);
    expect(selected.data.upsertFieldsWidget.viewFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldMetadataId: selectedFieldId,
          isVisible: true,
        }),
      ]),
    );
    const loaded = await findOnePageLayout({
      input: { id: layoutId },
      gqlFields: layoutFields,
      expectToFail: false,
    });
    expect(loaded.errors).toBeUndefined();
    expect(
      loaded.data.getPageLayout?.tabs?.[0].widgets?.[0].configuration,
    ).toMatchObject({ relationFieldMetadataId: companyFieldId, viewId });
  });

  it.each([true, false])(
    'persists read-only (%s) without changing the target layout',
    async (isReadOnly) => {
      const saved = await save(
        companyFieldId,
        companyId,
        viewId,
        false,
        isReadOnly,
      );
      expect(saved.errors).toBeUndefined();
      expect(
        saved.data.updatePageLayoutWithTabsAndWidgets.tabs?.[0].widgets?.[0]
          .configuration,
      ).toMatchObject({
        isReadOnly,
        relationFieldMetadataId: companyFieldId,
        viewId,
      });
    },
  );

  it('accepts a concrete many-to-one morph target', async () => {
    const { objects } = await findManyObjectMetadata({
      input: { filter: {}, paging: { first: 100 } },
      gqlFields:
        'id nameSingular fieldsList { id name morphRelations { sourceFieldMetadata { id } targetObjectMetadata { id } } }',
      expectToFail: false,
    });
    const source = objects.find(
      (object) => object.nameSingular === 'noteTarget',
    );
    if (!source) {
      throw new Error('Seeded morph source missing');
    }
    const morphField = z
      .object({
        morphRelations: z.array(
          z.object({
            sourceFieldMetadata: z.object({ id: z.string() }),
            targetObjectMetadata: z.object({ id: z.string() }),
          }),
        ),
      })
      .parse(source.fieldsList?.find((field) => field.name === 'target'));
    const relation = morphField.morphRelations.find(
      (relation) => relation.targetObjectMetadata.id === companyId,
    );
    if (!relation) {
      throw new Error('Seeded morph target missing');
    }
    const layout = await createOnePageLayout({
      input: {
        name: 'Morph fields from relation test',
        type: PageLayoutType.RECORD_PAGE,
        objectMetadataId: source.id,
      },
      expectToFail: false,
    });
    const morphLayoutId = layout.data.createPageLayout.id;
    const morphViewId = v4();
    const morphTabId = v4();
    try {
      await createOneView({
        input: {
          id: morphViewId,
          name: 'Morph company fields',
          icon: 'IconListDetails',
          objectMetadataId: companyId,
          type: ViewType.FIELDS_WIDGET,
        },
        expectToFail: false,
      });
      const saved = await updateOnePageLayoutWithTabsAndWidgets({
        input: {
          id: morphLayoutId,
          name: 'Morph fields from relation test',
          type: PageLayoutType.RECORD_PAGE,
          objectMetadataId: source.id,
          tabs: [
            {
              id: morphTabId,
              title: 'Home',
              position: 0,
              layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
              widgets: [
                {
                  id: v4(),
                  pageLayoutTabId: morphTabId,
                  title: 'Company from relation',
                  type: WidgetType.FIELDS_FROM_RELATION,
                  objectMetadataId: companyId,
                  position: {
                    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
                    index: 0,
                  },
                  configuration: {
                    configurationType:
                      WidgetConfigurationType.FIELDS_FROM_RELATION,
                    relationFieldMetadataId: relation.sourceFieldMetadata.id,
                    viewId: morphViewId,
                    newFieldDefaultVisibility: false,
                  },
                },
              ],
            },
          ],
        },
        gqlFields: layoutFields,
        expectToFail: false,
      });
      expect(saved.errors).toBeUndefined();
      expect(
        saved.data.updatePageLayoutWithTabsAndWidgets.tabs?.[0].widgets?.[0]
          .configuration,
      ).toMatchObject({
        relationFieldMetadataId: relation.sourceFieldMetadata.id,
        viewId: morphViewId,
      });
    } finally {
      await destroyOnePageLayout({
        input: { id: morphLayoutId },
        expectToFail: false,
      });
    }
  });

  it('rejects an unconfigured source', async () => {
    expect((await save('', companyId, viewId, true)).errors).toBeDefined();
  });

  it('rejects a collection-valued relation instead of picking a record', async () => {
    const saved = await save(peopleFieldId, personId, viewId, true);
    expect(saved.errors).toBeDefined();
  });

  it('replaces the target layout and removes the abandoned view', async () => {
    const nextViewId = v4();
    await createOneView({
      input: {
        id: nextViewId,
        name: 'Company Fields',
        icon: 'IconListDetails',
        objectMetadataId: companyId,
        type: ViewType.FIELDS_WIDGET,
      },
      expectToFail: false,
    });
    const saved = await save(companyFieldId, companyId, nextViewId);
    expect(saved.errors).toBeUndefined();
    expect(
      saved.data.updatePageLayoutWithTabsAndWidgets.tabs?.[0].widgets?.[0]
        .configuration,
    ).toMatchObject({
      viewId: nextViewId,
      relationFieldMetadataId: companyFieldId,
    });
    const remainingViews = await global.testDataSource.query(
      'SELECT id FROM core.view WHERE id = $1 AND "deletedAt" IS NULL',
      [viewId],
    );
    expect(remainingViews).toHaveLength(0);
  });
  it('keeps the old view when a FIELDS widget changes viewId', async () => {
    const fieldsLayout = await createOnePageLayout({
      input: {
        name: 'Fields view replacement',
        type: PageLayoutType.RECORD_PAGE,
        objectMetadataId: personId,
      },
      expectToFail: false,
    });
    const fieldsLayoutId = fieldsLayout.data.createPageLayout.id;
    const fieldsTabId = v4();
    const fieldsWidgetId = v4();
    const oldViewId = v4();
    const newViewId = v4();
    try {
      for (const id of [oldViewId, newViewId]) {
        await createOneView({
          input: {
            id,
            name: 'Person fields',
            icon: 'IconListDetails',
            objectMetadataId: personId,
            type: ViewType.FIELDS_WIDGET,
          },
          expectToFail: false,
        });
      }
      for (const fieldsViewId of [oldViewId, newViewId]) {
        const saved = await updateOnePageLayoutWithTabsAndWidgets({
          input: {
            id: fieldsLayoutId,
            name: 'Fields view replacement',
            type: PageLayoutType.RECORD_PAGE,
            objectMetadataId: personId,
            tabs: [
              {
                id: fieldsTabId,
                title: 'Home',
                position: 0,
                layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
                widgets: [
                  {
                    id: fieldsWidgetId,
                    pageLayoutTabId: fieldsTabId,
                    title: 'Person fields',
                    type: WidgetType.FIELDS,
                    objectMetadataId: personId,
                    position: {
                      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
                      index: 0,
                    },
                    configuration: {
                      configurationType: WidgetConfigurationType.FIELDS,
                      viewId: fieldsViewId,
                      newFieldDefaultVisibility: false,
                    },
                  },
                ],
              },
            ],
          },
          gqlFields: 'id',
          expectToFail: false,
        });
        expect(saved.errors).toBeUndefined();
      }
      const remainingViews = await global.testDataSource.query(
        'SELECT id FROM core.view WHERE id = $1 AND "deletedAt" IS NULL',
        [oldViewId],
      );
      expect(remainingViews).toEqual([{ id: oldViewId }]);
    } finally {
      await destroyOnePageLayout({
        input: { id: fieldsLayoutId },
        expectToFail: false,
      });
    }
  });
});
