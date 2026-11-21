import type * as ReactModule from 'react';
import type * as FieldContextModule from '@/object-record/record-field/ui/contexts/FieldContext';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { FieldInputEventContext } from '@/object-record/record-field/ui/contexts/FieldInputEventContext';
import { BooleanFieldInput } from '@/object-record/record-field/ui/meta-types/input/components/BooleanFieldInput';
import { useRecordInlineCellContext } from '@/object-record/record-inline-cell/components/RecordInlineCellContext';
import { FieldsFromRelationInlineCellAnchoredPortal } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationInlineCellAnchoredPortal';
import { FieldsFromRelationWidgetFieldList } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidgetFieldList';
import { getDefaultObjectPermissions } from '@/object-metadata/utils/getDefaultObjectPermissions';
import { getRecordFieldInputInstanceId } from '@/object-record/utils/getRecordFieldInputId';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext, type ReactNode } from 'react';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

const mockObject = getMockObjectMetadataItemOrThrow('company');
const mockField = mockObject.fields.find(
  (field) => field.name === 'employees',
)!;
let mockRecordReadOnly = false;
let mockRestrictedNames: string[] = [];
let mockPermissions = getDefaultObjectPermissions();
const mockSetHover = jest.fn();
const mockDirectOpen = jest.fn();

jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: () => ({ objectMetadataItem: mockObject }),
}));
jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({ objectMetadataItems: [mockObject] }),
}));
jest.mock('@/object-record/hooks/useObjectPermissions', () => ({
  useObjectPermissions: () => ({
    objectPermissionsByObjectMetadataId: { [mockObject.id]: mockPermissions },
  }),
}));
jest.mock('@/object-record/read-only/hooks/useIsRecordReadOnly', () => ({
  useIsRecordReadOnly: () => mockRecordReadOnly,
}));
jest.mock('@/object-record/read-only/hooks/useIsRecordFieldReadOnly', () => ({
  useIsRecordFieldReadOnly: () =>
    mockRecordReadOnly ||
    !mockPermissions.canUpdateAllRecords ||
    mockPermissions.uneditableFields.includes(mockField.id),
}));
jest.mock(
  '@/object-record/record-store/hooks/useRecordRestrictedFieldNames',
  () => ({ useRecordRestrictedFieldNames: () => mockRestrictedNames }),
);
jest.mock(
  '@/object-record/record-show/hooks/useRecordShowContainerData',
  () => ({ useRecordShowContainerData: () => ({ recordLoading: false }) }),
);
jest.mock(
  '@/object-record/record-show/hooks/useRecordShowContainerActions',
  () => ({
    useRecordShowContainerActions: () => ({
      useUpdateOneObjectRecordMutation: jest.fn(),
    }),
  }),
);
jest.mock('@/ui/layout/contexts/useTargetRecord', () => ({
  useTargetRecord: () => ({
    id: 'linked-company',
    targetObjectNameSingular: 'company',
  }),
}));
jest.mock('@/ui/utilities/state/jotai/hooks/useSetAtomComponentState', () => ({
  useSetAtomComponentState: () => mockSetHover,
}));
jest.mock('@/object-record/hooks/useUpdateOneRecord', () => ({
  useUpdateOneRecord: () => ({ updateOneRecord: jest.fn() }),
}));
jest.mock('@/object-record/record-field/ui/hooks/useGetButtonIcon', () => ({
  useGetButtonIcon: () => undefined,
}));
jest.mock('twenty-ui/icon/provider', () => ({
  useIcons: () => ({ getIcon: () => () => null }),
}));
jest.mock(
  '@/object-record/record-inline-cell/components/RecordInlineCellCloseOnSidePanelOpeningEffect',
  () => ({ RecordInlineCellCloseOnSidePanelOpeningEffect: () => null }),
);
jest.mock(
  '@/object-record/record-field/ui/contexts/FieldFocusContextProvider',
  () => ({
    FieldFocusStaticFocusedProvider: ({ children }: { children: ReactNode }) =>
      children,
  }),
);
jest.mock(
  '@/object-record/record-field/ui/meta-types/hooks/useBooleanField',
  () => ({ useBooleanField: () => ({ fieldValue: false }) }),
);
jest.mock(
  '@/object-record/record-inline-cell/components/RecordInlineCell',
  () => ({
    RecordInlineCell: () => {
      const { useContext: useReactContext } =
        jest.requireActual<typeof ReactModule>('react');
      const { FieldContext: Context } = jest.requireActual<
        typeof FieldContextModule
      >('@/object-record/record-field/ui/contexts/FieldContext');
      const context = useReactContext(Context);
      return context.isForbidden ? (
        <span>Restricted field</span>
      ) : (
        <>
          <button disabled={context.isRecordFieldReadOnly}>
            Edit employees
          </button>
          <button onClick={context.onOpenEditMode ?? mockDirectOpen}>
            Open employees directly
          </button>
        </>
      );
    },
  }),
);

describe('FieldsFromRelationReadOnly @custom', () => {
  beforeEach(() => {
    mockDirectOpen.mockClear();
    mockRecordReadOnly = false;
    mockRestrictedNames = [];
    mockPermissions = getDefaultObjectPermissions();
  });

  const renderList = (isReadOnly: boolean) =>
    render(
      <FieldsFromRelationWidgetFieldList
        isReadOnly={isReadOnly}
        instanceId="widget"
        fields={[
          {
            fieldMetadataItem: mockField,
            globalIndex: 0,
            position: 0,
            isVisible: true,
          },
        ]}
      />,
    );

  it.each([true, false])(
    'combines widget read-only (%s) with object and field permissions',
    (isReadOnly) => {
      const { rerender } = renderList(isReadOnly);
      expect(
        screen.getByRole('button', { name: 'Edit employees' }),
      ).toHaveProperty('disabled', isReadOnly);
      mockPermissions = { ...mockPermissions, canUpdateAllRecords: false };
      rerender(
        <FieldsFromRelationWidgetFieldList
          isReadOnly={false}
          instanceId="widget"
          fields={[
            {
              fieldMetadataItem: mockField,
              globalIndex: 0,
              position: 0,
              isVisible: true,
            },
          ]}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Edit employees' }),
      ).toBeDisabled();
    },
  );

  it.each(['metadata', 'record'])(
    'never displays a field restricted by %s permissions',
    (restriction) => {
      if (restriction === 'metadata') {
        mockPermissions.unreadableFields = [mockField.id];
      } else {
        mockRestrictedNames = [mockField.name];
      }
      renderList(false);
      expect(screen.getByText('Restricted field')).toBeVisible();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    },
  );

  const PortalProbe = () => {
    const { isRecordFieldReadOnly, isForbidden } = useContext(FieldContext);
    const { readonly } = useRecordInlineCellContext();
    return (
      <button disabled={isRecordFieldReadOnly || readonly || isForbidden}>
        Edit popup
      </button>
    );
  };

  const renderPortal = (
    isReadOnly: boolean,
    isEditing = false,
    children: ReactNode = <PortalProbe />,
  ) => {
    const anchor = document.createElement('div');
    anchor.id = getRecordFieldInputInstanceId({
      recordId: 'linked-company',
      fieldName: mockField.name,
      prefix: 'widget',
    });
    document.body.appendChild(anchor);
    return render(
      <FieldsFromRelationInlineCellAnchoredPortal
        isReadOnly={isReadOnly}
        isEditing={isEditing}
        fieldMetadataItem={mockField}
        objectMetadataItem={mockObject}
        recordId="linked-company"
        instanceIdPrefix="widget"
      >
        {children}
      </FieldsFromRelationInlineCellAnchoredPortal>,
    );
  };

  afterEach(() => {
    document
      .getElementById(
        getRecordFieldInputInstanceId({
          recordId: 'linked-company',
          fieldName: mockField.name,
          prefix: 'widget',
        }),
      )
      ?.remove();
  });

  it.each([true, false])(
    'applies widget read-only (%s) inside the hover portal',
    (isReadOnly) => {
      renderPortal(isReadOnly);
      expect(screen.getByRole('button', { name: 'Edit popup' })).toHaveProperty(
        'disabled',
        isReadOnly,
      );
    },
  );

  it('keeps denied permissions when the toggle is off', () => {
    mockRecordReadOnly = true;
    renderPortal(false);
    expect(screen.getByRole('button', { name: 'Edit popup' })).toBeDisabled();
  });

  it('does not mount an edit popup when permission is revoked', () => {
    mockRecordReadOnly = true;
    renderPortal(false, true);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([true, false])(
    'native boolean inputs respect widget read-only (%s)',
    async (isReadOnly) => {
      const onSubmit = jest.fn();
      renderPortal(
        isReadOnly,
        false,
        <FieldInputEventContext.Provider value={{ onSubmit }}>
          <BooleanFieldInput testId="boolean-value" />
        </FieldInputEventContext.Provider>,
      );
      await userEvent.click(screen.getByTestId('boolean-value'));
      expect(onSubmit).toHaveBeenCalledTimes(isReadOnly ? 0 : 1);
    },
  );

  it.each([true, false])(
    'blocks direct native open handlers when read-only is %s',
    async (isReadOnly) => {
      renderList(isReadOnly);
      await userEvent.click(
        screen.getByRole('button', { name: 'Open employees directly' }),
      );
      expect(mockDirectOpen).toHaveBeenCalledTimes(isReadOnly ? 0 : 1);
    },
  );
});
