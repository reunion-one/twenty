import { isOwnedByInstalledApplication } from '@/applications/utils/isOwnedByInstalledApplication';
import {
  SettingsAiAvailabilityRow,
  AVAILABILITY_TABLE_GRID_TEMPLATE_COLUMNS,
} from '@/settings/ai/tool-availability/components/SettingsAiAvailabilityRow';
import { useAiToolAvailabilities } from '@/settings/ai/tool-availability/hooks/useAiToolAvailabilities';
import { SaveAndCancelButtons } from '@/settings/components/SaveAndCancelButtons/SaveAndCancelButtons';
import { SettingsSearchFilterTrigger } from '@/settings/components/SettingsSearchFilterTrigger';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { SkeletonLine } from '@/ui/feedback/skeleton/components/SkeletonLine';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState } from 'react';
import { isDefined, isValidUuid } from 'twenty-shared/utils';
import { SearchInput } from 'twenty-ui/components/input';
import { Section } from 'twenty-ui/components/layout';
import { Dropdown } from 'twenty-ui/components/navigation';
import { SettingsRow } from 'twenty-ui/components/settings';
import { IconLock, IconPuzzle, IconTool } from 'twenty-ui/icon';
import { Checkbox } from 'twenty-ui/primitives/input';
import { themeCssVariables, useTheme } from 'twenty-ui/theme';
import { normalizeSearchText } from 'twenty-ui/utilities';
import {
  AiToolAvailabilityLimitsDocument,
  PermissionFlagType,
  type SetAiToolAvailabilityInput,
} from '~/generated-metadata/graphql';
import { useSettingsAgentToolsTable } from '~/pages/settings/ai/hooks/useSettingsAgentToolsTable';
import { type SettingsAgentToolItem } from '~/pages/settings/ai/types/SettingsAgentToolItem';
import { getToolApplicationId } from '~/pages/settings/ai/utils/getToolApplicationId';

const DEFAULT_AVAILABILITY = { isAgentEnabled: true, isMcpEnabled: true };

const StyledSearchContainer = styled.div`
  padding-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledAllRow = styled(TableRow)`
  background-color: ${themeCssVariables.background.secondary};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

export const SettingsAiAvailabilityTab = () => {
  const { t } = useLingui();
  const theme = useTheme();
  const {
    allTools,
    applicationById,
    marketplaceAppByUniversalIdentifier,
    currentWorkspace,
    isLoading,
  } = useSettingsAgentToolsTable();
  const canEdit = useHasPermissionFlag(PermissionFlagType.AI_SETTINGS);
  const {
    availabilityByToolIdentifier,
    isLoading: isAvailabilityLoading,
    setAvailabilities,
  } = useAiToolAvailabilities();
  const {
    data: limitsData,
    loading: isLimitsLoading,
    error: limitsError,
  } = useQuery(AiToolAvailabilityLimitsDocument, {
    fetchPolicy: 'cache-first',
  });
  const [draft, setDraft] = useState(
    new Map<string, Omit<SetAiToolAvailabilityInput, 'toolIdentifier'>>(),
  );
  const [openIdentifiers, setOpenIdentifiers] = useState(new Set<string>());
  const [isSaving, setIsSaving] = useState(false);
  const isDisabled =
    !canEdit ||
    isLoading ||
    isAvailabilityLoading ||
    isLimitsLoading ||
    isDefined(limitsError) ||
    isSaving;

  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomTools, setShowCustomTools] = useState(true);
  const [showManagedTools, setShowManagedTools] = useState(true);
  const [showStandardTools, setShowStandardTools] = useState(true);

  const workspaceCustomApplicationId =
    currentWorkspace?.workspaceCustomApplication?.id;

  // shortcut: filters mirror the Tools tab; keep in sync when its filtering changes.
  const filteredTools = useMemo(() => {
    const isManaged = (applicationId?: string | null) =>
      isOwnedByInstalledApplication({
        applicationId,
        workspaceCustomApplicationId,
      });
    const searchNormalized = normalizeSearchText(searchTerm);

    return allTools
      .filter((tool) => {
        const matchesSearch =
          normalizeSearchText(tool.label ?? tool.name).includes(
            searchNormalized,
          ) ||
          normalizeSearchText(tool.description ?? '').includes(
            searchNormalized,
          );

        if (!matchesSearch) {
          return false;
        }

        if (!isDefined(tool.applicationId)) {
          return showStandardTools;
        }

        if (isManaged(tool.applicationId)) {
          return showManagedTools;
        }

        return showCustomTools;
      })
      .sort((firstTool, secondTool) =>
        (firstTool.label ?? firstTool.name).localeCompare(
          secondTool.label ?? secondTool.name,
        ),
      );
  }, [
    allTools,
    searchTerm,
    showCustomTools,
    showManagedTools,
    showStandardTools,
    workspaceCustomApplicationId,
  ]);

  const { neverAvailableToAgents, neverAvailableOverMcp } = useMemo(
    () => ({
      neverAvailableToAgents: new Set(
        limitsData?.aiToolAvailabilityLimits.neverAvailableToAgents,
      ),
      neverAvailableOverMcp: new Set(
        limitsData?.aiToolAvailabilityLimits.neverAvailableOverMcp,
      ),
    }),
    [limitsData?.aiToolAvailabilityLimits],
  );

  const getAvailability = (toolIdentifier: string) =>
    draft.get(toolIdentifier) ??
    availabilityByToolIdentifier.get(toolIdentifier) ??
    DEFAULT_AVAILABILITY;

  const isLocked = (
    tool: SettingsAgentToolItem,
    field: 'isAgentEnabled' | 'isMcpEnabled',
  ) =>
    !isValidUuid(tool.identifier) &&
    (field === 'isAgentEnabled'
      ? neverAvailableToAgents.has(tool.name)
      : neverAvailableOverMcp.has(tool.name));

  const changeAvailabilities = useCallback(
    (items: SetAiToolAvailabilityInput[]) => {
      setDraft((previousDraft) => {
        const nextDraft = new Map(previousDraft);
        for (const { toolIdentifier, isAgentEnabled, isMcpEnabled } of items) {
          const serverAvailability =
            availabilityByToolIdentifier.get(toolIdentifier);
          if (
            isAgentEnabled === (serverAvailability?.isAgentEnabled ?? true) &&
            isMcpEnabled === (serverAvailability?.isMcpEnabled ?? true)
          ) {
            nextDraft.delete(toolIdentifier);
          } else {
            const previousAvailability = previousDraft.get(toolIdentifier);
            if (
              previousAvailability?.isAgentEnabled !== isAgentEnabled ||
              previousAvailability?.isMcpEnabled !== isMcpEnabled
            ) {
              nextDraft.set(toolIdentifier, { isAgentEnabled, isMcpEnabled });
            }
          }
        }
        return nextDraft;
      });
    },
    [availabilityByToolIdentifier],
  );

  const handleAvailabilityChange = useCallback(
    (
      toolIdentifier: string,
      availability: Omit<SetAiToolAvailabilityInput, 'toolIdentifier'>,
    ) => {
      changeAvailabilities([{ toolIdentifier, ...availability }]);
    },
    [changeAvailabilities],
  );

  const handleToggle = useCallback((toolIdentifier: string) => {
    setOpenIdentifiers((previousIdentifiers) => {
      const nextIdentifiers = new Set(previousIdentifiers);
      if (nextIdentifiers.has(toolIdentifier)) {
        nextIdentifiers.delete(toolIdentifier);
      } else {
        nextIdentifiers.add(toolIdentifier);
      }
      return nextIdentifiers;
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const successful = await setAvailabilities(
      Array.from(draft, ([toolIdentifier, availability]) => ({
        toolIdentifier,
        ...availability,
      })),
    );
    if (successful) {
      setDraft(new Map());
    }
    setIsSaving(false);
  };

  return (
    <Section.Root>
      <Section.Header
        title={t`Tool Availability`}
        description={t`Choose where each tool can be used`}
        actions={
          canEdit && draft.size > 0 ? (
            <SaveAndCancelButtons
              onSave={() => {
                void handleSave();
              }}
              onCancel={() => setDraft(new Map())}
              isLoading={isSaving}
              isSaveDisabled={isDisabled}
              isCancelDisabled={isSaving}
            />
          ) : undefined
        }
      />
      <StyledSearchContainer>
        <SearchInput
          placeholder={t`Search a tool...`}
          value={searchTerm}
          onValueChange={setSearchTerm}
          actions={
            <DropdownRoot
              dropdownId="settings-availability-filter-dropdown"
              type="panel"
            >
              <SettingsSearchFilterTrigger />
              <DropdownContent
                side="bottom"
                align="end"
                sideOffset={8}
                alignOffset={0}
              >
                <Dropdown.Section>
                  <SettingsRow
                    startElement={<IconTool />}
                    onCheckedChange={setShowCustomTools}
                    checked={showCustomTools}
                  >{t`Custom`}</SettingsRow>
                  <SettingsRow
                    startElement={<IconLock />}
                    onCheckedChange={setShowManagedTools}
                    checked={showManagedTools}
                  >{t`Managed`}</SettingsRow>
                  <SettingsRow
                    startElement={<IconPuzzle />}
                    onCheckedChange={setShowStandardTools}
                    checked={showStandardTools}
                  >{t`Standard`}</SettingsRow>
                </Dropdown.Section>
              </DropdownContent>
            </DropdownRoot>
          }
        />
      </StyledSearchContainer>
      <Table>
        <TableRow
          gridTemplateColumns={AVAILABILITY_TABLE_GRID_TEMPLATE_COLUMNS}
        >
          <TableHeader>{t`Name`}</TableHeader>
          <TableHeader>{t`App`}</TableHeader>
          <TableHeader>{t`Agents`}</TableHeader>
          <TableHeader>{t`MCP`}</TableHeader>
        </TableRow>
        <StyledAllRow
          gridTemplateColumns={AVAILABILITY_TABLE_GRID_TEMPLATE_COLUMNS}
        >
          <TableCell color={themeCssVariables.font.color.primary}>
            {t`All (shown rows)`}
          </TableCell>
          <TableCell />
          {(['isAgentEnabled', 'isMcpEnabled'] as const).map((field) => {
            const eligibleTools = filteredTools.filter(
              (tool) => !isLocked(tool, field),
            );
            const enabledCount = eligibleTools.filter(
              (tool) => getAvailability(tool.identifier)[field],
            ).length;
            const allEnabled =
              eligibleTools.length > 0 && enabledCount === eligibleTools.length;
            return (
              <TableCell key={field}>
                <Checkbox
                  aria-label={
                    field === 'isAgentEnabled'
                      ? t`Agents for all shown tools`
                      : t`MCP for all shown tools`
                  }
                  checked={allEnabled}
                  indeterminate={enabledCount > 0 && !allEnabled}
                  disabled={isDisabled || eligibleTools.length === 0}
                  onCheckedChange={() =>
                    changeAvailabilities(
                      eligibleTools.map((tool) => ({
                        toolIdentifier: tool.identifier,
                        ...getAvailability(tool.identifier),
                        [field]: !allEnabled,
                      })),
                    )
                  }
                />
              </TableCell>
            );
          })}
        </StyledAllRow>
        {isLoading ? (
          <SkeletonLine height={32} />
        ) : filteredTools.length === 0 ? (
          <TableRow>
            <TableCell color={themeCssVariables.font.color.tertiary}>
              {t`No tools found`}
            </TableCell>
          </TableRow>
        ) : (
          filteredTools.map((tool) => {
            const application = isDefined(tool.applicationId)
              ? applicationById.get(tool.applicationId)
              : undefined;
            const marketplaceApp = isDefined(application)
              ? marketplaceAppByUniversalIdentifier.get(
                  application.universalIdentifier,
                )
              : undefined;
            return (
              <SettingsAiAvailabilityRow
                key={tool.identifier}
                tool={tool}
                application={application}
                marketplaceApp={marketplaceApp}
                applicationId={getToolApplicationId(tool, currentWorkspace)}
                availability={getAvailability(tool.identifier)}
                isAgentLocked={isLocked(tool, 'isAgentEnabled')}
                isMcpLocked={isLocked(tool, 'isMcpEnabled')}
                isDisabled={isDisabled}
                isOpen={openIdentifiers.has(tool.identifier)}
                iconSize={theme.icon.size.md}
                iconStroke={theme.icon.stroke.sm}
                onToggle={handleToggle}
                onChange={handleAvailabilityChange}
              />
            );
          })
        )}
      </Table>
    </Section.Root>
  );
};
