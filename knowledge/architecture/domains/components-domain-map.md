---
title: "Components Domain Map"
type: domain-context-map
status: active
domain: components
layer: 4
---

# Components Domain Map

> Atmospheric Minimalism & High-Craft UI surfaces across Chat, IDE, and Stubs Architecture Workspaces.

## Domain Metrics & Canonical Hubs
- **Layer Tier**: Layer 4 (UI Components & Workspaces)
- **Production Modules**: 76
- **Canonical Hubs**: `src/components/settings/SettingsSectionCard.tsx` (fan-in: 5, fan-out: 0), `src/components/BatchDeleteOverlay.tsx` (fan-in: 4, fan-out: 3), `src/components/BatchSelectionHeader.tsx` (fan-in: 4, fan-out: 2), `src/components/ErrorBoundary.tsx` (fan-in: 3, fan-out: 1)

## Module Inventory & Dependency Contracts
- `src/components/settings/SettingsSectionCard.tsx` (L4, 46L, fan-in:5) — `[deps: none]` · `[caps: SettingsSectionCardProps, SettingsSectionCard]`
- `src/components/BatchDeleteOverlay.tsx` (L4, 65L, fan-in:4) — `[deps: FloatingBatchActionBar.tsx, BulkDeleteConfirmModal.tsx, useBulkActionConfirm.ts]` · `[caps: BatchDeleteOverlayProps, BatchDeleteOverlay]`
- `src/components/BatchSelectionHeader.tsx` (L4, 54L, fan-in:4) — `[deps: batchSelectionManager.ts, DatasetScopeBanner.tsx]` · `[caps: BatchSelectionHeaderProps, BatchSelectionHeader]`
- `src/components/ErrorBoundary.tsx` (L4, 96L, fan-in:3) — `[deps: errorReporter.ts]` · `[caps: ErrorBoundaryProps, ErrorBoundary]`
- `src/components/ui/Drawer.tsx` (L4, 106L, fan-in:3) — `[deps: useBackNavigation.ts, useGlobalKeydown.ts]` · `[caps: Drawer]`
- `src/components/WorkspaceRouter.tsx` (L4, 95L, fan-in:3) — `[deps: ChatWorkspace.tsx, MobileIDEWorkspace.tsx, StubsWorkspace.tsx, types.ts, integrations.ts, ErrorBoundary.tsx]` · `[caps: ChatWorkspaceProps, IDEOpenedFile, IDEWorkspaceProps, WorkspaceRouterProps, WorkspaceRouter]`
- `src/components/Combobox.tsx` (L4, 268L, fan-in:2) — `[deps: ServiceContext.tsx]` · `[caps: ComboboxOption, Combobox]`
- `src/components/GoogleIcon.tsx` (L4, 29L, fan-in:2) — `[deps: none]` · `[caps: GoogleIcon]`
- `src/components/IDEFileExplorerSidebar.tsx` (L4, 426L, fan-in:2) — `[deps: stubs.ts, fileTree.ts]` · `[caps: ExplorerVirtualFile, IDEFileExplorerSidebarProps, IDEFileExplorerSidebar]`
- `src/components/integrations/FirebaseExplorerPanel.tsx` (L4, 706L, fan-in:2) — `[deps: integrations.ts, integrationService.ts, errorHandling.ts]` · `[caps: FirebaseExplorerPanelProps, FirebaseExplorerPanel]`
- `src/components/integrations/GcpExplorerPanel.tsx` (L4, 747L, fan-in:2) — `[deps: integrations.ts, integrationService.ts, errorHandling.ts]` · `[caps: GcpExplorerPanelProps, GcpExplorerPanel]`
- `src/components/integrations/GitHubExplorerPanel.tsx` (L4, 621L, fan-in:2) — `[deps: integrations.ts, integrationService.ts, errorHandling.ts]` · `[caps: GitHubExplorerPanelProps, GitHubExplorerPanel]`
- `src/components/integrations/VercelExplorerPanel.tsx` (L4, 668L, fan-in:2) — `[deps: integrations.ts, integrationService.ts, errorHandling.ts]` · `[caps: VercelExplorerPanelProps, VercelExplorerPanel]`
- `src/components/prompt-tools/PromptToolActionDock.tsx` (L4, 51L, fan-in:2) — `[deps: none]` · `[caps: PromptToolActionDock]`
- `src/components/settings/SettingsTabsConfig.ts` (L4, 44L, fan-in:2) — `[deps: types.ts]` · `[caps: SettingsTabConfig, SETTINGS_TABS_CONFIG, resolveSettingsTab]`
- `src/components/TokenCounterVisualization.tsx` (L4, 113L, fan-in:2) — `[deps: none]` · `[caps: TokenCounterVisualizationProps, formatTokenNumber, TokenCounterVisualization]`
- `src/components/tuner/TunerConfigPanel.tsx` (L4, 616L, fan-in:2) — `[deps: types.ts, modelCatalog.ts, ServiceContext.tsx]` · `[caps: TunerActionHandlers, TunerBottomSheetProps, TunerConfigPanel]`
- `src/components/ui/AlertDialog.tsx` (L4, 109L, fan-in:2) — `[deps: useGlobalKeydown.ts]` · `[caps: AlertDialogProps, AlertDialog]`
- `src/components/ui/Dialog.tsx` (L4, 85L, fan-in:2) — `[deps: useGlobalKeydown.ts]` · `[caps: DialogProps, Dialog]`
- `src/components/AndroidFrame.tsx` (L4, 52L, fan-in:1) — `[deps: types.ts]` · `[caps: AndroidFrame]`
- `src/components/AuthRequiredBanner.tsx` (L4, 36L, fan-in:1) — `[deps: none]` · `[caps: AuthRequiredBanner]`
- `src/components/BottomNavBar.tsx` (L4, 107L, fan-in:1) — `[deps: types.ts, Drawer.tsx, WorkspaceNavConfig.ts, ServiceContext.tsx]` · `[caps: BottomNavBar]`
- `src/components/BulkDeleteConfirmModal.tsx` (L4, 54L, fan-in:1) — `[deps: AlertDialog.tsx]` · `[caps: BulkDeleteConfirmModalProps, BulkDeleteConfirmModal]`
- `src/components/ChatHistoryPopover.tsx` (L4, 186L, fan-in:1) — `[deps: types.ts, BatchSelectionHeader.tsx]` · `[caps: ChatHistoryPopoverProps, ChatHistoryPopover]`
- `src/components/ChatWorkspace.tsx` (L4, 1850L, fan-in:1) — `[deps: WorkspaceContext.tsx, ChatHistoryPopover.tsx, useBatchSelection.ts, BatchDeleteOverlay.tsx, types.ts, speechExtractor.ts]` · `[caps: ChatWorkspace]`
- `src/components/ClipboardKeyBanner.tsx` (L4, 69L, fan-in:1) — `[deps: ServiceContext.tsx]` · `[caps: ClipboardKeyBanner]`
- `src/components/CodeEditor.tsx` (L4, 102L, fan-in:1) — `[deps: syntaxHighlight.ts]` · `[caps: CodeEditorProps, CodeEditor]`
- `src/components/CodeExportModal.tsx` (L4, 134L, fan-in:1) — `[deps: types.ts, codeGeneratorService.ts, ServiceContext.tsx]` · `[caps: CodeExportModal]`
- `src/components/ConflictResolutionModal.tsx` (L4, 111L, fan-in:1) — `[deps: index.ts]` · `[caps: ConflictResolutionHandlers, ConflictResolutionModalProps, ConflictResolutionModal]`
- `src/components/CustomTabBrowserModal.tsx` (L4, 346L, fan-in:1) — `[deps: ServiceContext.tsx, useBackNavigation.ts]` · `[caps: CustomTabBrowserModal]`
- `src/components/DatasetScopeBanner.tsx` (L4, 20L, fan-in:1) — `[deps: none]` · `[caps: DatasetScopeBannerProps, DatasetScopeBanner]`
- `src/components/DesktopWrapperGuide.tsx` (L4, 175L, fan-in:1) — `[deps: ServiceContext.tsx]` · `[caps: DesktopWrapperGuide]`
- `src/components/FloatingBatchActionBar.tsx` (L4, 77L, fan-in:1) — `[deps: none]` · `[caps: BatchAction, FloatingBatchActionBarProps, FloatingBatchActionBar]`
- `src/components/GoogleAuthCard.tsx` (L4, 213L, fan-in:1) — `[deps: GoogleIcon.tsx, useGoogleAuth.ts]` · `[caps: GoogleAuthCardProps, GoogleAuthCard]`
- `src/components/ImportProjectSheet.tsx` (L4, 459L, fan-in:1) — `[deps: types.ts, ServiceContext.tsx, index.ts, modelCatalog.ts, useBackNavigation.ts]` · `[caps: ImportProjectSheet]`
- `src/components/integrations/IDERemoteSyncModal.tsx` (L4, 405L, fan-in:1) — `[deps: Dialog.tsx, integrations.ts, integrationCatalog.ts, useIntegrations.ts, errorHandling.ts, FirebaseExplorerPanel.tsx]` · `[caps: IDERemoteSyncModalProps, IDERemoteSyncModal]`
- `src/components/integrations/IntegrationConnectionModal.tsx` (L4, 606L, fan-in:1) — `[deps: integrations.ts, integrationService.ts, integrationCatalog.ts, useIntegrations.ts, errorHandling.ts]` · `[caps: IntegrationConnectionModalProps, IntegrationConnectionModal]`
- `src/components/integrations/IntegrationsHubSection.tsx` (L4, 444L, fan-in:1) — `[deps: integrations.ts, integrationCatalog.ts, useIntegrations.ts, errorHandling.ts, SettingsSectionCard.tsx, IntegrationConnectionModal.tsx]` · `[caps: IntegrationsHubSectionProps, IntegrationsHubSection]`
- `src/components/LibraryModal.tsx` (L4, 290L, fan-in:1) — `[deps: BatchSelectionHeader.tsx, BatchDeleteOverlay.tsx, types.ts, useOfflineQueue.ts, templates.ts, useBatchSelection.ts]` · `[caps: LibraryModal]`
- `src/components/MobileIDEWorkspace.tsx` (L4, 1137L, fan-in:1) — `[deps: WorkspaceRouter.tsx, WorkspaceContext.tsx, ServiceContext.tsx, CodeEditor.tsx, IDEFileExplorerSidebar.tsx, IDERemoteSyncModal.tsx]` · `[caps: MobileIDEWorkspace]`
- `src/components/OfflineIndicator.tsx` (L4, 130L, fan-in:1) — `[deps: ConflictResolutionModal.tsx, useOfflineSync.ts, ServiceContext.tsx]` · `[caps: OfflineIndicator]`
- `src/components/prompt-tools/FewShotBuilderTool.tsx` (L4, 268L, fan-in:1) — `[deps: ServiceContext.tsx, PromptToolActionDock.tsx, types.ts]` · `[caps: FewShotBuilderTool]`
- `src/components/prompt-tools/VariablePromptTool.tsx` (L4, 210L, fan-in:1) — `[deps: PromptToolActionDock.tsx, ServiceContext.tsx]` · `[caps: VariablePromptTool]`
- `src/components/PromptTemplateDrawer.tsx` (L4, 745L, fan-in:1) — `[deps: PromptTemplateItem.tsx, types.ts, ServiceContext.tsx, FewShotBuilderTool.tsx, VariablePromptTool.tsx, Drawer.tsx]` · `[caps: PromptTemplateDrawer]`
- `src/components/PWAInstallButton.tsx` (L4, 247L, fan-in:1) — `[deps: usePWAInstall.ts]` · `[caps: PWAInstallButton]`
- `src/components/PWAUpdateBanner.tsx` (L4, 47L, fan-in:1) — `[deps: pwaUpdate.ts]` · `[caps: PWAUpdateBanner]`
- `src/components/SecurePrivacyShield.tsx` (L4, 44L, fan-in:1) — `[deps: none]` · `[caps: SecurePrivacyShield]`
- `src/components/settings/ActiveProjectsSection.tsx` (L4, 161L, fan-in:1) — `[deps: types.ts, BatchSelectionHeader.tsx, BatchDeleteOverlay.tsx, SettingsSectionCard.tsx, timeProvider.ts]` · `[caps: ActiveProjectsSectionProps, ActiveProjectsSection]`
- `src/components/settings/AIStudioKeySection.tsx` (L4, 86L, fan-in:1) — `[deps: SettingsSectionCard.tsx]` · `[caps: AIStudioKeySectionProps, AIStudioKeySection]`
- `src/components/settings/ProviderConnectionModal.tsx` (L4, 414L, fan-in:1) — `[deps: types.ts, providerCatalog.ts, useProviderConnections.ts]` · `[caps: ProviderConnectionModalProps, ProviderConnectionModal]`
- `src/components/settings/ProvidersKeysSection.tsx` (L4, 601L, fan-in:1) — `[deps: types.ts, SettingsSectionCard.tsx, providerCatalog.ts, useProviderConnections.ts, ProviderConnectionModal.tsx]` · `[caps: ProvidersKeysSectionProps, ProvidersKeysSection]`
- `src/components/settings/ServerConfigSection.tsx` (L4, 57L, fan-in:1) — `[deps: none]` · `[caps: ServerConfigSectionProps, ServerConfigSection]`
- `src/components/settings/SettingsAccountTab.tsx` (L4, 175L, fan-in:1) — `[deps: types.ts, useOfflineQueue.ts, GoogleAuthCard.tsx, ServiceContext.tsx, useProviderConnections.ts, useIntegrations.ts]` · `[caps: SettingsAccountTabProps, SettingsAccountTab]`
- `src/components/settings/SettingsAudioTab.tsx` (L4, 226L, fan-in:1) — `[deps: speechVoices.ts, ServiceContext.tsx]` · `[caps: SettingsAudioTabProps, SettingsAudioTab]`
- `src/components/settings/SettingsDisplayTab.tsx` (L4, 171L, fan-in:1) — `[deps: themeService.ts, types.ts]` · `[caps: SettingsDisplayTabProps, SettingsDisplayTab]`
- `src/components/settings/SettingsSecurityTab.tsx` (L4, 171L, fan-in:1) — `[deps: ServiceContext.tsx, errorReporter.ts]` · `[caps: SettingsSecurityTabProps, SettingsSecurityTab]`
- `src/components/settings/SettingsSidebar.tsx` (L4, 58L, fan-in:1) — `[deps: types.ts, SettingsTabsConfig.ts]` · `[caps: SettingsSidebarProps, SettingsSidebar]`
- `src/components/StorageWarningBanner.tsx` (L4, 37L, fan-in:1) — `[deps: degradationState.ts]` · `[caps: StorageWarningBanner]`
- `src/components/StreamErrorBanner.tsx` (L4, 102L, fan-in:1) — `[deps: none]` · `[caps: StreamErrorBanner]`
- `src/components/stubs/StubsDiagramTab.tsx` (L4, 413L, fan-in:1) — `[deps: stubs.ts, Combobox.tsx]` · `[caps: StubsDiagramTabProps, StubsDiagramTab]`
- `src/components/stubs/StubsGraphTab.tsx` (L4, 622L, fan-in:1) — `[deps: stubs.ts]` · `[caps: StubsGraphTabProps, StubsGraphTab]`
- `src/components/stubs/StubsImpactTab.tsx` (L4, 352L, fan-in:1) — `[deps: stubs.ts, Combobox.tsx]` · `[caps: StubsImpactTabProps, StubsImpactTab]`
- `src/components/stubs/StubsLintTab.tsx` (L4, 239L, fan-in:1) — `[deps: stubs.ts]` · `[caps: StubsLintTabProps, StubsLintTab]`
- `src/components/stubs/StubsSpecsTab.tsx` (L4, 273L, fan-in:1) — `[deps: stubs.ts]` · `[caps: StubsSpecsTabProps, StubsSpecsTab]`
- `src/components/stubs/StubsTerminalTab.tsx` (L4, 155L, fan-in:1) — `[deps: stubs.ts]` · `[caps: StubsTerminalLog, StubsTerminalTabProps, StubsTerminalTab]`
- `src/components/StubsWorkspace.tsx` (L4, 462L, fan-in:1) — `[deps: errorHandling.ts, StubsTerminalTab.tsx, StubsLintTab.tsx, StubsGraphTab.tsx, StubsDiagramTab.tsx, StubsImpactTab.tsx]` · `[caps: StubsWorkspaceProps, StubsWorkspace]`
- `src/components/TopAppBar.tsx` (L4, 303L, fan-in:1) — `[deps: types.ts, useTheme.ts, useGoogleAuth.ts, TokenCounterVisualization.tsx, ServiceContext.tsx, PWAInstallButton.tsx]` · `[caps: TopAppBarProps, TopAppBar]`
- `src/components/TunerBottomSheet.tsx` (L4, 30L, fan-in:1) — `[deps: Drawer.tsx, TunerConfigPanel.tsx]` · `[caps: TunerActionHandlers, TunerBottomSheetProps, TunerBottomSheet]`
- `src/components/ui/DialogBody.tsx` (L4, 15L, fan-in:1) — `[deps: none]` · `[caps: DialogBodyProps, DialogBody]`
- `src/components/ui/DialogFooter.tsx` (L4, 15L, fan-in:1) — `[deps: none]` · `[caps: DialogFooterProps, DialogFooter]`
- `src/components/ui/index.ts` (L4, 5L, fan-in:1) — `[deps: Dialog.tsx, DialogBody.tsx, DialogFooter.tsx, AlertDialog.tsx]` · `[caps: internal]`
- `src/components/ui/PromptTemplateItem.tsx` (L4, 178L, fan-in:1) — `[deps: types.ts]` · `[caps: PromptTemplateItemProps, PromptTemplateItem]`
- `src/components/UnifiedSettingsModal.tsx` (L4, 508L, fan-in:1) — `[deps: useSettingsProjectsState.ts, SettingsAudioTab.tsx, SettingsSidebar.tsx, SettingsTabsConfig.ts, types.ts, TunerConfigPanel.tsx]` · `[caps: AccountSettingsProps, ProjectSettingsProps, SpeechSettingsProps, LibrarySettingsProps, ConfigSettingsProps, UnifiedSettingsModalProps]`
- `src/components/WorkspaceNavConfig.ts` (L4, 31L, fan-in:1) — `[deps: types.ts]` · `[caps: WorkspaceItem, WORKSPACE_NAV_CONFIG]`
- `src/components/SegmentedControl.tsx` (L4, 125L, fan-in:0) — `[deps: useKeyboardNavigation.ts, useControllableState.ts]` · `[caps: SegmentedControl, SegmentedControlItem]`
- `src/components/Tabs.tsx` (L4, 173L, fan-in:0) — `[deps: useKeyboardNavigation.ts, useControllableState.ts]` · `[caps: Tabs, TabList, TabTrigger, TabPanel]`
