---
title: Components Domain — Domain Context Map
type: domain-context-map
domain: components
parent_map: ../context-map.md
description: Deep-dive context map for the components domain, subsystem responsibilities, and internal modules.
tags:
  - domain-map
  - components
  - agent-optimized
---

# Components Domain — Domain Context Map

Parent Context Map: knowledge/architecture/context-map.md

## Domain Purpose & Responsibilities
The Components Domain coordinates domain logic, core types, and services for the components subsystem.

## Key Modules & Files
src/components/ui/index.ts (Hub) -> deps: none | caps: internal
src/components/UnifiedSettingsModal.tsx -> deps: none | caps: AccountSettingsProps, ProjectSettingsProps, SpeechSettingsProps, LibrarySettingsProps, ConfigSettingsProps, UnifiedSettingsModalProps
src/components/Tabs.tsx -> deps: none | caps: TabsContextType, Tabs, TabList, TabTrigger, TabPanel
src/components/MobileIDEWorkspace.tsx -> deps: none | caps: MobileIDEWorkspaceProps, IDEFile, ConsoleLog
src/components/SegmentedControl.tsx -> deps: none | caps: SegmentedControlContextType, SegmentedControl, SegmentedControlItem
src/components/WorkspaceRouter.tsx -> deps: none | caps: ChatWorkspaceProps, IDEWorkspaceProps, WorkspaceRouterProps
src/components/Combobox.tsx -> deps: none | caps: ComboboxOption, ComboboxProps
src/components/ConflictResolutionModal.tsx -> deps: none | caps: ConflictResolutionHandlers, ConflictResolutionModalProps
src/components/FloatingBatchActionBar.tsx -> deps: none | caps: BatchAction, FloatingBatchActionBarProps
src/components/PWAInstallButton.tsx -> deps: none | caps: PWAInstallButtonProps, InstallGuideModalProps
src/components/prompt-tools/VariablePromptTool.tsx -> deps: none | caps: VariablePromptToolProps, PresetItem
src/components/settings/SettingsTabsConfig.ts -> deps: none | caps: SettingsTabConfig, resolveSettingsTab
src/components/tuner/TunerConfigPanel.tsx -> deps: none | caps: TunerActionHandlers, TunerBottomSheetProps
src/components/StubsWorkspace.tsx -> deps: none | caps: StubsWorkspaceProps, StubsSubTab
src/components/AndroidFrame.tsx -> deps: none | caps: AndroidFrameProps
src/components/AuthRequiredBanner.tsx -> deps: none | caps: AuthRequiredBannerProps
src/components/BatchDeleteOverlay.tsx -> deps: none | caps: BatchDeleteOverlayProps
src/components/BatchSelectionHeader.tsx -> deps: none | caps: BatchSelectionHeaderProps
src/components/BulkDeleteConfirmModal.tsx -> deps: none | caps: BulkDeleteConfirmModalProps
src/components/ClipboardKeyBanner.tsx -> deps: none | caps: ClipboardKeyBannerProps
src/components/CodeExportModal.tsx -> deps: none | caps: CodeExportModalProps
src/components/DatasetScopeBanner.tsx -> deps: none | caps: DatasetScopeBannerProps
src/components/DesktopWrapperGuide.tsx -> deps: none | caps: DesktopWrapperGuideProps
src/components/GoogleAuthCard.tsx -> deps: none | caps: GoogleAuthCardProps
src/components/GoogleIcon.tsx -> deps: none | caps: GoogleIconProps
src/components/ImportProjectSheet.tsx -> deps: none | caps: ImportProjectSheetProps
src/components/JulesActivityCard.tsx -> deps: none | caps: JulesActivityCardProps
src/components/JulesSessionDrawer.tsx -> deps: none | caps: JulesSessionDrawerProps
src/components/LibraryModal.tsx -> deps: none | caps: LibraryModalProps
src/components/PromptTemplateDrawer.tsx -> deps: none | caps: PromptTemplateDrawerProps
src/components/SecurePrivacyShield.tsx -> deps: none | caps: SecurePrivacyShieldProps
src/components/StreamErrorBanner.tsx -> deps: none | caps: StreamErrorBannerProps
src/components/TokenCounterVisualization.tsx -> deps: none | caps: TokenCounterVisualizationProps
src/components/prompt-tools/FewShotBuilderTool.tsx -> deps: none | caps: FewShotBuilderToolProps
src/components/prompt-tools/PromptToolActionDock.tsx -> deps: none | caps: PromptToolActionDockProps
src/components/settings/ActiveProjectsSection.tsx -> deps: none | caps: ActiveProjectsSectionProps
src/components/settings/JulesKeySection.tsx -> deps: none | caps: JulesKeySectionProps
src/components/settings/ServerConfigSection.tsx -> deps: none | caps: ServerConfigSectionProps
src/components/settings/SettingsAudioTab.tsx -> deps: none | caps: SettingsAudioTabProps
src/components/settings/SettingsDisplayTab.tsx -> deps: none | caps: SettingsDisplayTabProps
src/components/settings/SettingsSectionCard.tsx -> deps: none | caps: SettingsSectionCardProps
src/components/settings/SettingsSecurityTab.tsx -> deps: none | caps: SettingsSecurityTabProps
src/components/settings/SettingsSidebar.tsx -> deps: none | caps: SettingsSidebarProps
src/components/stubs/StubsDiagramTab.tsx -> deps: none | caps: StubsDiagramTabProps
src/components/stubs/StubsGraphTab.tsx -> deps: none | caps: StubsGraphTabProps
src/components/stubs/StubsImpactTab.tsx -> deps: none | caps: StubsImpactTabProps
src/components/stubs/StubsLintTab.tsx -> deps: none | caps: StubsLintTabProps
src/components/stubs/StubsSpecsTab.tsx -> deps: none | caps: StubsSpecsTabProps
src/components/stubs/StubsTerminalTab.tsx -> deps: none | caps: StubsTerminalTabProps
src/components/ui/AlertDialog.tsx -> deps: none | caps: AlertDialogProps
src/components/ui/Dialog.tsx -> deps: none | caps: DialogProps
src/components/ui/DialogBody.tsx -> deps: none | caps: DialogBodyProps
src/components/ui/DialogFooter.tsx -> deps: none | caps: DialogFooterProps
src/components/ui/Drawer.tsx -> deps: none | caps: DrawerProps
src/components/ui/PromptTemplateItem.tsx -> deps: none | caps: PromptTemplateItemProps
src/components/BottomNavBar.tsx -> deps: none | caps: BottomNavBarProps
src/components/ChatHistoryPopover.tsx -> deps: none | caps: ChatHistoryPopoverProps
src/components/ChatWorkspace.tsx -> deps: none | caps: ChatWorkspaceProps
src/components/CustomTabBrowserModal.tsx -> deps: none | caps: CustomTabBrowserModalProps
src/components/TopAppBar.tsx -> deps: none | caps: TopAppBarProps
src/components/WorkspaceNavConfig.ts -> deps: none | caps: WorkspaceItem
src/components/settings/AIStudioKeySection.tsx -> deps: none | caps: AIStudioKeySectionProps
src/components/settings/SettingsAccountTab.tsx -> deps: none | caps: SettingsAccountTabProps
src/components/OfflineIndicator.tsx -> deps: none | caps: internal
src/components/TunerBottomSheet.tsx -> deps: none | caps: internal

## Domain Invariants
- Downward dependencies only: cross-domain calls must target canonical domain hubs.
- External consumers must interface through index.ts, never private internal helpers.
- State changes must adhere to lifecycle and containment invariants.
