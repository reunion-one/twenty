import { findUnconfiguredFieldsFromRelationWidget } from '@/page-layout/widgets/fields-from-relation/utils/findUnconfiguredFieldsFromRelationWidget';
import { createDefaultFieldsFromRelationWidget } from '@/page-layout/widgets/fields-from-relation/utils/createDefaultFieldsFromRelationWidget';
import {
  makeDraft,
  makeTab,
  makeWidget,
} from '@/page-layout/testing/pageLayoutDraftFixtures';

const widget = createDefaultFieldsFromRelationWidget({
  id: 'widget',
  pageLayoutTabId: 'tab',
  objectMetadataId: 'company',
  positionIndex: 0,
});

describe('findUnconfiguredFieldsFromRelationWidget @custom', () => {
  it('accepts missing drafts and ordinary fields widgets', () => {
    expect(findUnconfiguredFieldsFromRelationWidget(undefined)).toBeUndefined();
    expect(
      findUnconfiguredFieldsFromRelationWidget(
        makeDraft([makeTab('tab', [makeWidget('fields', 0)])]),
      ),
    ).toBeUndefined();
  });

  it.each([
    { relationFieldMetadataId: '', viewId: 'view' },
    { relationFieldMetadataId: 'relation', viewId: '' },
  ])('finds a widget missing a source or view: %s', (configuration) => {
    const unconfigured = {
      ...widget,
      configuration: { ...widget.configuration, ...configuration },
    };
    expect(
      findUnconfiguredFieldsFromRelationWidget(
        makeDraft([makeTab('tab', [unconfigured])]),
      ),
    ).toBe(unconfigured);
  });

  it('accepts a configured widget', () => {
    const configured = {
      ...widget,
      configuration: {
        ...widget.configuration,
        relationFieldMetadataId: 'relation',
        viewId: 'view',
      },
    };
    expect(
      findUnconfiguredFieldsFromRelationWidget(
        makeDraft([makeTab('tab', [configured])]),
      ),
    ).toBeUndefined();
  });

  it('rejects a widget with the wrong configuration type', () => {
    const unconfigured = {
      ...widget,
      configuration: makeWidget('fields', 0).configuration,
    };
    expect(
      findUnconfiguredFieldsFromRelationWidget(
        makeDraft([makeTab('tab', [unconfigured])]),
      ),
    ).toBe(unconfigured);
  });
});
