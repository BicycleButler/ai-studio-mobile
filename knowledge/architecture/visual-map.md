---
title: Project Architecture Visual Diagram
type: visual-diagram
audience: human-developer
tags:
  - architecture
  - visual
  - mermaid
---

# Architecture Visual Map

<!-- For AI coding agents: read knowledge/architecture/context-map.md or run npx stubs query "map:" -->

```mermaid
flowchart TD
  subgraph L6 ["Layer 6: Interface"]
    n_src_components_AndroidFrame_tsx["AndroidFrame.tsx"]
    n_src_components_AuthRequiredBanner_tsx["AuthRequiredBanner.tsx"]
    n_src_components_BatchDeleteOverlay_tsx["BatchDeleteOverlay.tsx"]
    n_src_components_BatchSelectionHeader_tsx["BatchSelectionHeader.tsx"]
    n_src_components_BulkDeleteConfirmModal_tsx["BulkDeleteConfirmModal.tsx"]
    n_src_components_ClipboardKeyBanner_tsx["ClipboardKeyBanner.tsx"]
    n_src_components_CodeExportModal_tsx["CodeExportModal.tsx"]
    n_src_components_Combobox_tsx["Combobox.tsx"]
    n_src_components_ConflictResolutionModal_tsx["ConflictResolutionModal.tsx"]
    n_src_components_DatasetScopeBanner_tsx["DatasetScopeBanner.tsx"]
    n_src_components_DesktopWrapperGuide_tsx["DesktopWrapperGuide.tsx"]
    n_src_components_FloatingBatchActionBar_tsx["FloatingBatchActionBar.tsx"]
    n_src_components_GoogleAuthCard_tsx["GoogleAuthCard.tsx"]
    n_src_components_GoogleIcon_tsx["GoogleIcon.tsx"]
    n_src_components_ImportProjectSheet_tsx["ImportProjectSheet.tsx"]
    n_src_components_JulesActivityCard_tsx["JulesActivityCard.tsx"]
    n_src_components_JulesSessionDrawer_tsx["JulesSessionDrawer.tsx"]
    n_src_components_LibraryModal_tsx["LibraryModal.tsx"]
    n_src_components_MobileIDEWorkspace_tsx["MobileIDEWorkspace.tsx"]
    n_src_components_OfflineIndicator_tsx["OfflineIndicator.tsx"]
    n_src_components_PWAInstallButton_tsx["PWAInstallButton.tsx"]
    n_src_components_PromptTemplateDrawer_tsx["PromptTemplateDrawer.tsx"]
    n_src_components_SecurePrivacyShield_tsx["SecurePrivacyShield.tsx"]
    n_src_components_SegmentedControl_tsx["SegmentedControl.tsx"]
    n_src_components_StreamErrorBanner_tsx["StreamErrorBanner.tsx"]
    n_src_components_Tabs_tsx["Tabs.tsx"]
    n_src_components_TokenCounterVisualization_test_ts["TokenCounterVisualization.test.ts"]
    n_src_components_TokenCounterVisualization_tsx["TokenCounterVisualization.tsx"]
    n_src_components_TunerBottomSheet_tsx["TunerBottomSheet.tsx"]
    n_src_components_prompt_tools_FewShotBuilderTool_tsx["FewShotBuilderTool.tsx"]
    n_src_components_prompt_tools_PromptToolActionDock_tsx["PromptToolActionDock.tsx"]
    n_src_components_prompt_tools_VariablePromptTool_tsx["VariablePromptTool.tsx"]
    n_src_components_settings_ActiveProjectsSection_tsx["ActiveProjectsSection.tsx"]
    n_src_components_settings_JulesKeySection_tsx["JulesKeySection.tsx"]
    n_src_components_settings_ServerConfigSection_tsx["ServerConfigSection.tsx"]
    n_src_components_settings_SettingsAudioTab_tsx["SettingsAudioTab.tsx"]
    n_src_components_settings_SettingsDisplayTab_tsx["SettingsDisplayTab.tsx"]
    n_src_components_settings_SettingsSectionCard_tsx["SettingsSectionCard.tsx"]
    n_src_components_settings_SettingsSecurityTab_tsx["SettingsSecurityTab.tsx"]
    n_src_components_settings_SettingsSidebar_tsx["SettingsSidebar.tsx"]
    n_src_components_settings_SettingsTabsConfig_ts["SettingsTabsConfig.ts"]
    n_src_components_stubs_StubsDiagramTab_tsx["StubsDiagramTab.tsx"]
    n_src_components_stubs_StubsGraphTab_tsx["StubsGraphTab.tsx"]
    n_src_components_stubs_StubsImpactTab_tsx["StubsImpactTab.tsx"]
    n_src_components_stubs_StubsLintTab_tsx["StubsLintTab.tsx"]
    n_src_components_stubs_StubsSpecsTab_tsx["StubsSpecsTab.tsx"]
    n_src_components_stubs_StubsTerminalTab_tsx["StubsTerminalTab.tsx"]
    n_src_components_tuner_TunerConfigPanel_tsx["TunerConfigPanel.tsx"]
    n_src_components_ui_AlertDialog_tsx["AlertDialog.tsx"]
    n_src_components_ui_Dialog_tsx["Dialog.tsx"]
    n_src_components_ui_DialogBody_tsx["DialogBody.tsx"]
    n_src_components_ui_DialogFooter_tsx["DialogFooter.tsx"]
    n_src_components_ui_Drawer_tsx["Drawer.tsx"]
    n_src_components_ui_PromptTemplateItem_tsx["PromptTemplateItem.tsx"]
    n_src_components_ui_index_ts["index.ts"]
    n_src_contexts_WorkspaceContext_tsx["WorkspaceContext.tsx"]
    n_src_data_templates_ts["templates.ts"]
    n_src_hooks_settings_useSettingsProjectsState_ts["useSettingsProjectsState.ts"]
    n_src_hooks_stubs_useStubsData_ts["useStubsData.ts"]
    n_src_hooks_stubs_useStubsSpecs_ts["useStubsSpecs.ts"]
    n_src_hooks_stubs_useStubsTerminal_ts["useStubsTerminal.ts"]
    n_src_hooks_useAppAuth_ts["useAppAuth.ts"]
    n_src_hooks_useBackNavigation_ts["useBackNavigation.ts"]
    n_src_hooks_useBatchSelection_ts["useBatchSelection.ts"]
    n_src_hooks_useBulkActionConfirm_ts["useBulkActionConfirm.ts"]
    n_src_hooks_useChatSession_ts["useChatSession.ts"]
    n_src_hooks_useClipboardKeySniffer_ts["useClipboardKeySniffer.ts"]
    n_src_hooks_useControllableState_ts["useControllableState.ts"]
    n_src_hooks_useGeminiStream_ts["useGeminiStream.ts"]
    n_src_hooks_useGlobalKeydown_ts["useGlobalKeydown.ts"]
    n_src_hooks_useGoogleAuth_ts["useGoogleAuth.ts"]
    n_src_hooks_useJules_ts["useJules.ts"]
    n_src_hooks_useKeyboardNavigation_ts["useKeyboardNavigation.ts"]
    n_src_hooks_useModelConfig_ts["useModelConfig.ts"]
    n_src_hooks_useNetworkStatus_ts["useNetworkStatus.ts"]
    n_src_hooks_useOfflineQueue_ts["useOfflineQueue.ts"]
    n_src_hooks_useOfflineSync_ts["useOfflineSync.ts"]
    n_src_hooks_usePWAInstall_ts["usePWAInstall.ts"]
    n_src_hooks_useProjectManager_ts["useProjectManager.ts"]
    n_src_hooks_usePromptTemplates_ts["usePromptTemplates.ts"]
    n_src_hooks_useSpeechToText_test_ts["useSpeechToText.test.ts"]
    n_src_hooks_useSpeechToText_ts["useSpeechToText.ts"]
    n_src_hooks_useStore_ts["useStore.ts"]
    n_src_hooks_useTheme_ts["useTheme.ts"]
    n_src_hooks_useWindowSecurity_ts["useWindowSecurity.ts"]
    n_src_main_tsx["main.tsx"]
    n_src_schemas_validation_test_ts["validation.test.ts"]
    n_src_schemas_validation_ts["validation.ts"]
    n_src_services_IPlatformService_ts["IPlatformService.ts"]
    n_src_services_appAuthManager_ts["appAuthManager.ts"]
    n_src_services_auth_test_ts["auth.test.ts"]
    n_src_services_auth_ts["auth.ts"]
    n_src_services_authProvider_test_ts["authProvider.test.ts"]
    n_src_services_authProvider_ts["authProvider.ts"]
    n_src_services_chatHistoryService_test_ts["chatHistoryService.test.ts"]
    n_src_services_chatHistoryService_ts["chatHistoryService.ts"]
    n_src_services_clipboardService_test_ts["clipboardService.test.ts"]
    n_src_services_clipboardService_ts["clipboardService.ts"]
    n_src_services_codeGeneratorService_test_ts["codeGeneratorService.test.ts"]
    n_src_services_codeGeneratorService_ts["codeGeneratorService.ts"]
    n_src_services_codeGenerators_BaseCodeGenerator_ts["BaseCodeGenerator.ts"]
    n_src_services_codeGenerators_CurlGenerator_ts["CurlGenerator.ts"]
    n_src_services_codeGenerators_ICodeGeneratorPlugin_ts["ICodeGeneratorPlugin.ts"]
    n_src_services_codeGenerators_KotlinGenerator_ts["KotlinGenerator.ts"]
    n_src_services_codeGenerators_PythonGenerator_ts["PythonGenerator.ts"]
    n_src_services_codeGenerators_TypeScriptGenerator_ts["TypeScriptGenerator.ts"]
    n_src_services_codeGenerators_index_ts["index.ts"]
    n_src_services_fileDownloadService_test_ts["fileDownloadService.test.ts"]
    n_src_services_fileDownloadService_ts["fileDownloadService.ts"]
    n_src_services_firebaseAuthProvider_ts["firebaseAuthProvider.ts"]
    n_src_services_geminiStreamService_test_ts["geminiStreamService.test.ts"]
    n_src_services_geminiStreamService_ts["geminiStreamService.ts"]
    n_src_services_googleAuth_ts["googleAuth.ts"]
    n_src_services_julesService_test_ts["julesService.test.ts"]
    n_src_services_julesService_ts["julesService.ts"]
    n_src_services_julesSessionOrchestrator_ts["julesSessionOrchestrator.ts"]
    n_src_services_keyVerification_test_ts["keyVerification.test.ts"]
    n_src_services_platformService_ts["platformService.ts"]
    n_src_services_promptTemplateService_test_ts["promptTemplateService.test.ts"]
    n_src_services_promptTemplateService_ts["promptTemplateService.ts"]
    n_src_services_pwaInstallService_ts["pwaInstallService.ts"]
    n_src_services_sentenceSpeechQueue_test_ts["sentenceSpeechQueue.test.ts"]
    n_src_services_sentenceSpeechQueue_ts["sentenceSpeechQueue.ts"]
    n_src_services_speechVoices_test_ts["speechVoices.test.ts"]
    n_src_services_speechVoices_ts["speechVoices.ts"]
    n_src_services_stubsService_test_ts["stubsService.test.ts"]
    n_src_services_stubsService_ts["stubsService.ts"]
    n_src_services_themeService_test_ts["themeService.test.ts"]
    n_src_services_themeService_ts["themeService.ts"]
    n_src_services_windowSecurityService_ts["windowSecurityService.ts"]
    n_src_types_speechRecognition_ts["speechRecognition.ts"]
    n_src_types_stubs_ts["stubs.ts"]
    n_src_utils_apiClient_ts["apiClient.ts"]
    n_src_utils_apiClientErrors_ts["apiClientErrors.ts"]
    n_src_utils_apiClientInterceptors_test_ts["apiClientInterceptors.test.ts"]
    n_src_utils_apiClientInterceptors_ts["apiClientInterceptors.ts"]
    n_src_utils_apiClientRetry_test_ts["apiClientRetry.test.ts"]
    n_src_utils_apiClientRetry_ts["apiClientRetry.ts"]
    n_src_utils_apiResponseParser_test_ts["apiResponseParser.test.ts"]
    n_src_utils_apiResponseParser_ts["apiResponseParser.ts"]
    n_src_utils_asyncStorage_test_ts["asyncStorage.test.ts"]
    n_src_utils_asyncStorage_ts["asyncStorage.ts"]
    n_src_utils_batchSelectionManager_test_ts["batchSelectionManager.test.ts"]
    n_src_utils_batchSelectionManager_ts["batchSelectionManager.ts"]
    n_src_utils_codeGenerators_ts["codeGenerators.ts"]
    n_src_utils_computedStore_test_ts["computedStore.test.ts"]
    n_src_utils_computedStore_ts["computedStore.ts"]
    n_src_utils_crossTabNotifier_BroadcastChannelNotifier_ts["BroadcastChannelNotifier.ts"]
    n_src_utils_crossTabNotifier_CrossTabNotifier_test_ts["CrossTabNotifier.test.ts"]
    n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts["CrossTabNotifierFactory.ts"]
    n_src_utils_crossTabNotifier_FallbackCrossTabNotifier_ts["FallbackCrossTabNotifier.ts"]
    n_src_utils_crossTabNotifier_StorageEventNotifier_ts["StorageEventNotifier.ts"]
    n_src_utils_crossTabNotifier_index_ts["index.ts"]
    n_src_utils_crossTabNotifier_types_ts["types.ts"]
    n_src_utils_delayStrategy_test_ts["delayStrategy.test.ts"]
    n_src_utils_delayStrategy_ts["delayStrategy.ts"]
    n_src_utils_errorHandling_test_ts["errorHandling.test.ts"]
    n_src_utils_errorHandling_ts["errorHandling.ts"]
    n_src_utils_eventEmitter_test_ts["eventEmitter.test.ts"]
    n_src_utils_eventEmitter_ts["eventEmitter.ts"]
    n_src_utils_idGenerator_test_ts["idGenerator.test.ts"]
    n_src_utils_idGenerator_ts["idGenerator.ts"]
    n_src_utils_imageCompressor_test_ts["imageCompressor.test.ts"]
    n_src_utils_imageCompressor_ts["imageCompressor.ts"]
    n_src_utils_index_ts["index.ts"]
    n_src_utils_logger_test_ts["logger.test.ts"]
    n_src_utils_logger_ts["logger.ts"]
    n_src_utils_modelCatalog_ts["modelCatalog.ts"]
    n_src_utils_mutex_ts["mutex.ts"]
    n_src_utils_networkStatus_ts["networkStatus.ts"]
    n_src_utils_observable_ts["observable.ts"]
    n_src_utils_observableBatching_test_ts["observableBatching.test.ts"]
    n_src_utils_offlineQueueStore_test_ts["offlineQueueStore.test.ts"]
    n_src_utils_offlineQueueStore_ts["offlineQueueStore.ts"]
    n_src_utils_offlineService_test_ts["offlineService.test.ts"]
    n_src_utils_offlineService_ts["offlineService.ts"]
    n_src_utils_platform_ts["platform.ts"]
    n_src_utils_polling_test_ts["polling.test.ts"]
    n_src_utils_polling_ts["polling.ts"]
    n_src_utils_randomProvider_test_ts["randomProvider.test.ts"]
    n_src_utils_randomProvider_ts["randomProvider.ts"]
    n_src_utils_speechExtractor_test_ts["speechExtractor.test.ts"]
    n_src_utils_speechExtractor_ts["speechExtractor.ts"]
    n_src_utils_sseParser_test_ts["sseParser.test.ts"]
    n_src_utils_sseParser_ts["sseParser.ts"]
    n_src_utils_storage_ActiveItemManager_test_ts["ActiveItemManager.test.ts"]
    n_src_utils_storage_ActiveItemManager_ts["ActiveItemManager.ts"]
    n_src_utils_storage_ActiveItemManagerFactory_ts["ActiveItemManagerFactory.ts"]
    n_src_utils_storage_FallbackStorageWrapper_test_ts["FallbackStorageWrapper.test.ts"]
    n_src_utils_storage_FallbackStorageWrapper_ts["FallbackStorageWrapper.ts"]
    n_src_utils_storage_MapCollection_test_ts["MapCollection.test.ts"]
    n_src_utils_storage_MapCollection_ts["MapCollection.ts"]
    n_src_utils_storage_StorageBase_ts["StorageBase.ts"]
    n_src_utils_storage_StorageCollection_test_ts["StorageCollection.test.ts"]
    n_src_utils_storage_StorageCollection_ts["StorageCollection.ts"]
    n_src_utils_storage_StorageFactory_ts["StorageFactory.ts"]
    n_src_utils_storage_StorageRegistry_test_ts["StorageRegistry.test.ts"]
    n_src_utils_storage_StorageRegistry_ts["StorageRegistry.ts"]
    n_src_utils_storage_StorageSingleton_test_ts["StorageSingleton.test.ts"]
    n_src_utils_storage_StorageSingleton_ts["StorageSingleton.ts"]
    n_src_utils_storage_core_ts["core.ts"]
    n_src_utils_storage_draftState_test_ts["draftState.test.ts"]
    n_src_utils_storage_encryption_ts["encryption.ts"]
    n_src_utils_storage_general_test_ts["general.test.ts"]
    n_src_utils_storage_general_ts["general.ts"]
    n_src_utils_storage_helpers_test_ts["helpers.test.ts"]
    n_src_utils_storage_jules_ts["jules.ts"]
    n_src_utils_storage_offlineRetryStrategy_test_ts["offlineRetryStrategy.test.ts"]
    n_src_utils_storage_offlineRetryStrategy_ts["offlineRetryStrategy.ts"]
    n_src_utils_storage_projects_test_ts["projects.test.ts"]
    n_src_utils_storage_projects_ts["projects.ts"]
    n_src_utils_storage_prompts_ts["prompts.ts"]
    n_src_utils_storage_selectionStrategy_test_ts["selectionStrategy.test.ts"]
    n_src_utils_storage_selectionStrategy_ts["selectionStrategy.ts"]
    n_src_utils_storage_serializer_JsonSerializer_test_ts["JsonSerializer.test.ts"]
    n_src_utils_storage_serializer_JsonSerializer_ts["JsonSerializer.ts"]
    n_src_utils_storage_serializer_index_ts["index.ts"]
    n_src_utils_storage_serializer_types_ts["types.ts"]
    n_src_utils_storage_syncAdapter_test_ts["syncAdapter.test.ts"]
    n_src_utils_storage_syncAdapter_ts["syncAdapter.ts"]
    n_src_utils_storage_syncAdapterErrors_ts["syncAdapterErrors.ts"]
    n_src_utils_storage_syncAdapterFormData_test_ts["syncAdapterFormData.test.ts"]
    n_src_utils_storage_syncAdapterFormData_ts["syncAdapterFormData.ts"]
    n_src_utils_storage_types_ts["types.ts"]
    n_src_utils_storage_test_ts["storage.test.ts"]
    n_src_utils_syncEngine_test_ts["syncEngine.test.ts"]
    n_src_utils_syncEngine_ts["syncEngine.ts"]
    n_src_utils_syncEngineStrategy_ts["syncEngineStrategy.ts"]
    n_src_utils_syncOrchestrator_ts["syncOrchestrator.ts"]
    n_src_utils_testUtils_storageEvent_ts["storageEvent.ts"]
    n_src_utils_timeProvider_test_ts["timeProvider.test.ts"]
    n_src_utils_timeProvider_ts["timeProvider.ts"]
    n_src_utils_urlUtils_test_ts["urlUtils.test.ts"]
    n_src_utils_urlUtils_ts["urlUtils.ts"]
    n_src_App_tsx["App.tsx"]
    n_src_components_BottomNavBar_tsx["BottomNavBar.tsx"]
    n_src_components_ChatHistoryPopover_tsx["ChatHistoryPopover.tsx"]
    n_src_components_ChatWorkspace_tsx["ChatWorkspace.tsx"]
    n_src_components_CustomTabBrowserModal_tsx["CustomTabBrowserModal.tsx"]
    n_src_components_MobileIDE_test_ts["MobileIDE.test.ts"]
    n_src_components_StubsWorkspace_tsx["StubsWorkspace.tsx"]
    n_src_components_TopAppBar_tsx["TopAppBar.tsx"]
    n_src_components_UnifiedSettingsModal_tsx["UnifiedSettingsModal.tsx"]
    n_src_components_WorkspaceNavConfig_ts["WorkspaceNavConfig.ts"]
    n_src_components_WorkspaceRouter_tsx["WorkspaceRouter.tsx"]
    n_src_components_settings_AIStudioKeySection_tsx["AIStudioKeySection.tsx"]
    n_src_components_settings_SettingsAccountTab_tsx["SettingsAccountTab.tsx"]
    n_src_hooks_useAppState_ts["useAppState.ts"]
    n_src_hooks_useUIState_ts["useUIState.ts"]
    n_src_services_ServiceContext_tsx["ServiceContext.tsx"]
    n_src_services_keyVerification_ts["keyVerification.ts"]
    n_src_types_ts["types.ts"]
    n_src_utils_mockDefinitions_ts["mockDefinitions.ts"]
    n_src_utils_storage_constants_ts["constants.ts"]
    n_src_utils_storage_draftState_ts["draftState.ts"]
    n_src_utils_storage_helpers_ts["helpers.ts"]
    n_src_utils_storage_index_ts["index.ts"]
    n_src_utils_syncRegistry_ts["syncRegistry.ts"]
  end
  n_src_components_AndroidFrame_tsx --> n_src_types_ts
  n_src_components_BatchDeleteOverlay_tsx --> n_src_components_FloatingBatchActionBar_tsx
  n_src_components_BatchDeleteOverlay_tsx --> n_src_components_BulkDeleteConfirmModal_tsx
  n_src_components_BatchDeleteOverlay_tsx --> n_src_hooks_useBulkActionConfirm_ts
  n_src_components_BatchSelectionHeader_tsx --> n_src_utils_batchSelectionManager_ts
  n_src_components_BatchSelectionHeader_tsx --> n_src_components_DatasetScopeBanner_tsx
  n_src_components_BulkDeleteConfirmModal_tsx --> n_src_components_ui_AlertDialog_tsx
  n_src_components_ClipboardKeyBanner_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_CodeExportModal_tsx --> n_src_types_ts
  n_src_components_CodeExportModal_tsx --> n_src_services_codeGeneratorService_ts
  n_src_components_CodeExportModal_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_Combobox_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_DesktopWrapperGuide_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_GoogleAuthCard_tsx --> n_src_components_GoogleIcon_tsx
  n_src_components_GoogleAuthCard_tsx --> n_src_hooks_useGoogleAuth_ts
  n_src_components_ImportProjectSheet_tsx --> n_src_types_ts
  n_src_components_ImportProjectSheet_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_ImportProjectSheet_tsx --> n_src_utils_modelCatalog_ts
  n_src_components_ImportProjectSheet_tsx --> n_src_hooks_useBackNavigation_ts
  n_src_components_JulesActivityCard_tsx --> n_src_types_ts
  n_src_components_JulesSessionDrawer_tsx --> n_src_components_BatchSelectionHeader_tsx
  n_src_components_JulesSessionDrawer_tsx --> n_src_components_BatchDeleteOverlay_tsx
  n_src_components_JulesSessionDrawer_tsx --> n_src_types_ts
  n_src_components_JulesSessionDrawer_tsx --> n_src_hooks_useOfflineQueue_ts
  n_src_components_JulesSessionDrawer_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_JulesSessionDrawer_tsx --> n_src_components_Combobox_tsx
  n_src_components_JulesSessionDrawer_tsx --> n_src_hooks_useBatchSelection_ts
  n_src_components_JulesSessionDrawer_tsx --> n_src_components_ui_Drawer_tsx
  n_src_components_JulesSessionDrawer_tsx --> n_src_hooks_useStore_ts
  n_src_components_LibraryModal_tsx --> n_src_components_BatchSelectionHeader_tsx
  n_src_components_LibraryModal_tsx --> n_src_components_BatchDeleteOverlay_tsx
  n_src_components_LibraryModal_tsx --> n_src_types_ts
  n_src_components_LibraryModal_tsx --> n_src_hooks_useOfflineQueue_ts
  n_src_components_LibraryModal_tsx --> n_src_data_templates_ts
  n_src_components_LibraryModal_tsx --> n_src_hooks_useBatchSelection_ts
  n_src_components_LibraryModal_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_MobileIDEWorkspace_tsx --> n_src_components_WorkspaceRouter_tsx
  n_src_components_MobileIDEWorkspace_tsx --> n_src_contexts_WorkspaceContext_tsx
  n_src_components_MobileIDEWorkspace_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_OfflineIndicator_tsx --> n_src_components_ConflictResolutionModal_tsx
  n_src_components_OfflineIndicator_tsx --> n_src_hooks_useOfflineSync_ts
  n_src_components_OfflineIndicator_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_PWAInstallButton_tsx --> n_src_hooks_usePWAInstall_ts
  n_src_components_PromptTemplateDrawer_tsx --> n_src_components_ui_PromptTemplateItem_tsx
  n_src_components_PromptTemplateDrawer_tsx --> n_src_types_ts
  n_src_components_PromptTemplateDrawer_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_PromptTemplateDrawer_tsx --> n_src_components_prompt_tools_FewShotBuilderTool_tsx
  n_src_components_PromptTemplateDrawer_tsx --> n_src_components_prompt_tools_VariablePromptTool_tsx
  n_src_components_PromptTemplateDrawer_tsx --> n_src_components_ui_Drawer_tsx
  n_src_components_PromptTemplateDrawer_tsx --> n_src_components_BatchSelectionHeader_tsx
  n_src_components_PromptTemplateDrawer_tsx --> n_src_hooks_useBatchSelection_ts
  n_src_components_PromptTemplateDrawer_tsx --> n_src_components_BatchDeleteOverlay_tsx
  n_src_components_SegmentedControl_tsx --> n_src_hooks_useKeyboardNavigation_ts
  n_src_components_SegmentedControl_tsx --> n_src_hooks_useControllableState_ts
  n_src_components_Tabs_tsx --> n_src_hooks_useKeyboardNavigation_ts
  n_src_components_Tabs_tsx --> n_src_hooks_useControllableState_ts
  n_src_components_TokenCounterVisualization_test_ts --> n_src_components_TokenCounterVisualization_tsx
  n_src_components_TunerBottomSheet_tsx --> n_src_components_tuner_TunerConfigPanel_tsx
  n_src_components_prompt_tools_FewShotBuilderTool_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_prompt_tools_FewShotBuilderTool_tsx --> n_src_components_prompt_tools_PromptToolActionDock_tsx
  n_src_components_prompt_tools_FewShotBuilderTool_tsx --> n_src_types_ts
  n_src_components_prompt_tools_VariablePromptTool_tsx --> n_src_components_prompt_tools_PromptToolActionDock_tsx
  n_src_components_prompt_tools_VariablePromptTool_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_settings_ActiveProjectsSection_tsx --> n_src_types_ts
  n_src_components_settings_ActiveProjectsSection_tsx --> n_src_components_BatchSelectionHeader_tsx
  n_src_components_settings_ActiveProjectsSection_tsx --> n_src_components_BatchDeleteOverlay_tsx
  n_src_components_settings_ActiveProjectsSection_tsx --> n_src_components_settings_SettingsSectionCard_tsx
  n_src_components_settings_ActiveProjectsSection_tsx --> n_src_utils_timeProvider_ts
  n_src_components_settings_JulesKeySection_tsx --> n_src_components_settings_SettingsSectionCard_tsx
  n_src_components_settings_SettingsAudioTab_tsx --> n_src_services_speechVoices_ts
  n_src_components_settings_SettingsAudioTab_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_settings_SettingsDisplayTab_tsx --> n_src_services_themeService_ts
  n_src_components_settings_SettingsDisplayTab_tsx --> n_src_types_ts
  n_src_components_settings_SettingsSecurityTab_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_settings_SettingsSidebar_tsx --> n_src_types_ts
  n_src_components_settings_SettingsSidebar_tsx --> n_src_components_settings_SettingsTabsConfig_ts
  n_src_components_settings_SettingsTabsConfig_ts --> n_src_types_ts
  n_src_components_stubs_StubsGraphTab_tsx --> n_src_types_stubs_ts
  n_src_components_stubs_StubsImpactTab_tsx --> n_src_types_stubs_ts
  n_src_components_stubs_StubsLintTab_tsx --> n_src_types_stubs_ts
  n_src_components_stubs_StubsSpecsTab_tsx --> n_src_types_stubs_ts
  n_src_components_tuner_TunerConfigPanel_tsx --> n_src_types_ts
  n_src_components_tuner_TunerConfigPanel_tsx --> n_src_utils_modelCatalog_ts
  n_src_components_tuner_TunerConfigPanel_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_ui_AlertDialog_tsx --> n_src_hooks_useGlobalKeydown_ts
  n_src_components_ui_Dialog_tsx --> n_src_hooks_useGlobalKeydown_ts
  n_src_components_ui_Drawer_tsx --> n_src_hooks_useBackNavigation_ts
  n_src_components_ui_Drawer_tsx --> n_src_hooks_useGlobalKeydown_ts
  n_src_components_ui_PromptTemplateItem_tsx --> n_src_types_ts
  n_src_contexts_WorkspaceContext_tsx --> n_src_types_ts
  n_src_contexts_WorkspaceContext_tsx --> n_src_services_speechVoices_ts
  n_src_data_templates_ts --> n_src_utils_timeProvider_ts
  n_src_data_templates_ts --> n_src_types_ts
  n_src_hooks_settings_useSettingsProjectsState_ts --> n_src_hooks_useBatchSelection_ts
  n_src_hooks_settings_useSettingsProjectsState_ts --> n_src_types_ts
  n_src_hooks_stubs_useStubsData_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_stubs_useStubsData_ts --> n_src_utils_errorHandling_ts
  n_src_hooks_stubs_useStubsData_ts --> n_src_types_ts
  n_src_hooks_stubs_useStubsSpecs_ts --> n_src_utils_errorHandling_ts
  n_src_hooks_stubs_useStubsSpecs_ts --> n_src_types_ts
  n_src_hooks_stubs_useStubsSpecs_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_stubs_useStubsTerminal_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useAppAuth_ts --> n_src_types_ts
  n_src_hooks_useAppAuth_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useBackNavigation_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useBatchSelection_ts --> n_src_utils_batchSelectionManager_ts
  n_src_hooks_useBatchSelection_ts --> n_src_hooks_useStore_ts
  n_src_hooks_useBatchSelection_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useChatSession_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useChatSession_ts --> n_src_types_ts
  n_src_hooks_useChatSession_ts --> n_src_services_promptTemplateService_ts
  n_src_hooks_useChatSession_ts --> n_src_hooks_useStore_ts
  n_src_hooks_useClipboardKeySniffer_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useGeminiStream_ts --> n_src_types_ts
  n_src_hooks_useGeminiStream_ts --> n_src_services_geminiStreamService_ts
  n_src_hooks_useGeminiStream_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useGlobalKeydown_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useGoogleAuth_ts --> n_src_types_ts
  n_src_hooks_useGoogleAuth_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useJules_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useJules_ts --> n_src_hooks_useStore_ts
  n_src_hooks_useJules_ts --> n_src_types_ts
  n_src_hooks_useModelConfig_ts --> n_src_types_ts
  n_src_hooks_useModelConfig_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useModelConfig_ts --> n_src_utils_modelCatalog_ts
  n_src_hooks_useNetworkStatus_ts --> n_src_hooks_useStore_ts
  n_src_hooks_useNetworkStatus_ts --> n_src_utils_networkStatus_ts
  n_src_hooks_useNetworkStatus_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useOfflineQueue_ts --> n_src_utils_offlineService_ts
  n_src_hooks_useOfflineQueue_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useOfflineQueue_ts --> n_src_hooks_useStore_ts
  n_src_hooks_useOfflineSync_ts --> n_src_hooks_useNetworkStatus_ts
  n_src_hooks_useOfflineSync_ts --> n_src_utils_offlineService_ts
  n_src_hooks_useOfflineSync_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useOfflineSync_ts --> n_src_hooks_useOfflineQueue_ts
  n_src_hooks_usePWAInstall_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_usePWAInstall_ts --> n_src_hooks_useStore_ts
  n_src_hooks_useProjectManager_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useProjectManager_ts --> n_src_hooks_useStore_ts
  n_src_hooks_useProjectManager_ts --> n_src_types_ts
  n_src_hooks_useSpeechToText_test_ts --> n_src_services_platformService_ts
  n_src_hooks_useSpeechToText_test_ts --> n_src_utils_speechExtractor_ts
  n_src_hooks_useSpeechToText_test_ts --> n_src_services_sentenceSpeechQueue_ts
  n_src_hooks_useSpeechToText_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useSpeechToText_ts --> n_src_types_speechRecognition_ts
  n_src_hooks_useStore_ts --> n_src_utils_observable_ts
  n_src_hooks_useTheme_ts --> n_src_services_themeService_ts
  n_src_hooks_useTheme_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useWindowSecurity_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useWindowSecurity_ts --> n_src_hooks_useStore_ts
  n_src_main_tsx --> n_src_services_platformService_ts
  n_src_main_tsx --> n_src_services_firebaseAuthProvider_ts
  n_src_main_tsx --> n_src_services_ServiceContext_tsx
  n_src_schemas_validation_test_ts --> n_src_schemas_validation_ts
  n_src_services_IPlatformService_ts --> n_src_utils_eventEmitter_ts
  n_src_services_IPlatformService_ts --> n_src_utils_platform_ts
  n_src_services_IPlatformService_ts --> n_src_types_speechRecognition_ts
  n_src_services_appAuthManager_ts --> n_src_types_ts
  n_src_services_appAuthManager_ts --> n_src_services_googleAuth_ts
  n_src_services_appAuthManager_ts --> n_src_services_auth_ts
  n_src_services_appAuthManager_ts --> n_src_utils_storage_general_ts
  n_src_services_appAuthManager_ts --> n_src_utils_logger_ts
  n_src_services_auth_test_ts --> n_src_utils_urlUtils_ts
  n_src_services_auth_test_ts --> n_src_utils_apiResponseParser_ts
  n_src_services_auth_test_ts --> n_src_utils_apiClientInterceptors_ts
  n_src_services_auth_test_ts --> n_src_utils_apiClient_ts
  n_src_services_auth_test_ts --> n_src_utils_logger_ts
  n_src_services_auth_test_ts --> n_src_services_googleAuth_ts
  n_src_services_auth_ts --> n_src_utils_apiClient_ts
  n_src_services_authProvider_test_ts --> n_src_services_authProvider_ts
  n_src_services_authProvider_ts --> n_src_types_ts
  n_src_services_chatHistoryService_test_ts --> n_src_utils_logger_ts
  n_src_services_chatHistoryService_test_ts --> n_src_services_chatHistoryService_ts
  n_src_services_chatHistoryService_test_ts --> n_src_types_ts
  n_src_services_chatHistoryService_ts --> n_src_services_IPlatformService_ts
  n_src_services_chatHistoryService_ts --> n_src_types_ts
  n_src_services_chatHistoryService_ts --> n_src_utils_storage_types_ts
  n_src_services_chatHistoryService_ts --> n_src_utils_logger_ts
  n_src_services_chatHistoryService_ts --> n_src_services_platformService_ts
  n_src_services_chatHistoryService_ts --> n_src_utils_mockDefinitions_ts
  n_src_services_chatHistoryService_ts --> n_src_utils_timeProvider_ts
  n_src_services_clipboardService_test_ts --> n_src_services_IPlatformService_ts
  n_src_services_clipboardService_test_ts --> n_src_services_clipboardService_ts
  n_src_services_clipboardService_test_ts --> n_src_utils_logger_ts
  n_src_services_clipboardService_ts --> n_src_services_IPlatformService_ts
  n_src_services_clipboardService_ts --> n_src_utils_logger_ts
  n_src_services_codeGeneratorService_test_ts --> n_src_types_ts
  n_src_services_codeGeneratorService_test_ts --> n_src_services_codeGeneratorService_ts
  n_src_services_codeGenerators_BaseCodeGenerator_ts --> n_src_types_ts
  n_src_services_codeGenerators_BaseCodeGenerator_ts --> n_src_services_codeGenerators_ICodeGeneratorPlugin_ts
  n_src_services_codeGenerators_CurlGenerator_ts --> n_src_types_ts
  n_src_services_codeGenerators_CurlGenerator_ts --> n_src_services_codeGenerators_BaseCodeGenerator_ts
  n_src_services_codeGenerators_CurlGenerator_ts --> n_src_services_codeGenerators_ICodeGeneratorPlugin_ts
  n_src_services_codeGenerators_ICodeGeneratorPlugin_ts --> n_src_types_ts
  n_src_services_codeGenerators_KotlinGenerator_ts --> n_src_types_ts
  n_src_services_codeGenerators_KotlinGenerator_ts --> n_src_services_codeGenerators_BaseCodeGenerator_ts
  n_src_services_codeGenerators_KotlinGenerator_ts --> n_src_services_codeGenerators_ICodeGeneratorPlugin_ts
  n_src_services_codeGenerators_PythonGenerator_ts --> n_src_types_ts
  n_src_services_codeGenerators_PythonGenerator_ts --> n_src_services_codeGenerators_BaseCodeGenerator_ts
  n_src_services_codeGenerators_PythonGenerator_ts --> n_src_services_codeGenerators_ICodeGeneratorPlugin_ts
  n_src_services_codeGenerators_TypeScriptGenerator_ts --> n_src_types_ts
  n_src_services_codeGenerators_TypeScriptGenerator_ts --> n_src_services_codeGenerators_BaseCodeGenerator_ts
  n_src_services_codeGenerators_TypeScriptGenerator_ts --> n_src_services_codeGenerators_ICodeGeneratorPlugin_ts
  n_src_services_fileDownloadService_test_ts --> n_src_services_IPlatformService_ts
  n_src_services_fileDownloadService_test_ts --> n_src_services_fileDownloadService_ts
  n_src_services_fileDownloadService_test_ts --> n_src_utils_logger_ts
  n_src_services_fileDownloadService_test_ts --> n_src_services_platformService_ts
  n_src_services_fileDownloadService_ts --> n_src_services_IPlatformService_ts
  n_src_services_fileDownloadService_ts --> n_src_utils_logger_ts
  n_src_services_fileDownloadService_ts --> n_src_services_platformService_ts
  n_src_services_firebaseAuthProvider_ts --> n_src_services_IPlatformService_ts
  n_src_services_firebaseAuthProvider_ts --> n_src_services_authProvider_ts
  n_src_services_firebaseAuthProvider_ts --> n_src_types_ts
  n_src_services_firebaseAuthProvider_ts --> n_src_utils_logger_ts
  n_src_services_firebaseAuthProvider_ts --> n_src_services_platformService_ts
  n_src_services_geminiStreamService_test_ts --> n_src_utils_urlUtils_ts
  n_src_services_geminiStreamService_test_ts --> n_src_utils_apiResponseParser_ts
  n_src_services_geminiStreamService_test_ts --> n_src_utils_apiClientInterceptors_ts
  n_src_services_geminiStreamService_test_ts --> n_src_utils_logger_ts
  n_src_services_geminiStreamService_test_ts --> n_src_utils_apiClient_ts
  n_src_services_geminiStreamService_test_ts --> n_src_services_geminiStreamService_ts
  n_src_services_geminiStreamService_ts --> n_src_services_IPlatformService_ts
  n_src_services_geminiStreamService_ts --> n_src_types_ts
  n_src_services_geminiStreamService_ts --> n_src_utils_apiClient_ts
  n_src_services_geminiStreamService_ts --> n_src_utils_sseParser_ts
  n_src_services_geminiStreamService_ts --> n_src_utils_logger_ts
  n_src_services_geminiStreamService_ts --> n_src_services_platformService_ts
  n_src_services_googleAuth_ts --> n_src_services_IPlatformService_ts
  n_src_services_googleAuth_ts --> n_src_utils_timeProvider_ts
  n_src_services_googleAuth_ts --> n_src_types_ts
  n_src_services_googleAuth_ts --> n_src_utils_storage_types_ts
  n_src_services_googleAuth_ts --> n_src_utils_apiClient_ts
  n_src_services_googleAuth_ts --> n_src_services_authProvider_ts
  n_src_services_googleAuth_ts --> n_src_utils_logger_ts
  n_src_services_googleAuth_ts --> n_src_services_platformService_ts
  n_src_services_julesService_test_ts --> n_src_utils_apiClient_ts
  n_src_services_julesService_test_ts --> n_src_services_julesService_ts
  n_src_services_julesService_ts --> n_src_utils_apiClient_ts
  n_src_services_julesService_ts --> n_src_utils_polling_ts
  n_src_services_julesService_ts --> n_src_types_ts
  n_src_services_julesSessionOrchestrator_ts --> n_src_types_ts
  n_src_services_julesSessionOrchestrator_ts --> n_src_services_julesService_ts
  n_src_services_julesSessionOrchestrator_ts --> n_src_utils_storage_jules_ts
  n_src_services_julesSessionOrchestrator_ts --> n_src_utils_timeProvider_ts
  n_src_services_julesSessionOrchestrator_ts --> n_src_utils_idGenerator_ts
  n_src_services_julesSessionOrchestrator_ts --> n_src_utils_logger_ts
  n_src_services_julesSessionOrchestrator_ts --> n_src_utils_errorHandling_ts
  n_src_services_julesSessionOrchestrator_ts --> n_src_utils_observable_ts
  n_src_services_keyVerification_test_ts --> n_src_utils_apiClient_ts
  n_src_services_keyVerification_test_ts --> n_src_utils_logger_ts
  n_src_services_keyVerification_test_ts --> n_src_utils_storage_projects_ts
  n_src_services_keyVerification_test_ts --> n_src_utils_storage_general_ts
  n_src_services_keyVerification_test_ts --> n_src_services_keyVerification_ts
  n_src_services_platformService_ts --> n_src_services_IPlatformService_ts
  n_src_services_platformService_ts --> n_src_utils_platform_ts
  n_src_services_platformService_ts --> n_src_utils_logger_ts
  n_src_services_platformService_ts --> n_src_types_speechRecognition_ts
  n_src_services_platformService_ts --> n_src_utils_eventEmitter_ts
  n_src_services_promptTemplateService_test_ts --> n_src_services_promptTemplateService_ts
  n_src_services_promptTemplateService_ts --> n_src_utils_timeProvider_ts
  n_src_services_promptTemplateService_ts --> n_src_types_ts
  n_src_services_promptTemplateService_ts --> n_src_utils_storage_types_ts
  n_src_services_promptTemplateService_ts --> n_src_utils_idGenerator_ts
  n_src_services_pwaInstallService_ts --> n_src_services_IPlatformService_ts
  n_src_services_pwaInstallService_ts --> n_src_utils_observable_ts
  n_src_services_pwaInstallService_ts --> n_src_services_platformService_ts
  n_src_services_sentenceSpeechQueue_test_ts --> n_src_utils_urlUtils_ts
  n_src_services_sentenceSpeechQueue_test_ts --> n_src_utils_apiResponseParser_ts
  n_src_services_sentenceSpeechQueue_test_ts --> n_src_utils_apiClientInterceptors_ts
  n_src_services_sentenceSpeechQueue_test_ts --> n_src_services_sentenceSpeechQueue_ts
  n_src_services_sentenceSpeechQueue_test_ts --> n_src_services_speechVoices_ts
  n_src_services_sentenceSpeechQueue_test_ts --> n_src_utils_apiClient_ts
  n_src_services_sentenceSpeechQueue_test_ts --> n_src_services_auth_ts
  n_src_services_sentenceSpeechQueue_ts --> n_src_services_IPlatformService_ts
  n_src_services_sentenceSpeechQueue_ts --> n_src_services_platformService_ts
  n_src_services_sentenceSpeechQueue_ts --> n_src_utils_speechExtractor_ts
  n_src_services_sentenceSpeechQueue_ts --> n_src_services_speechVoices_ts
  n_src_services_speechVoices_test_ts --> n_src_utils_urlUtils_ts
  n_src_services_speechVoices_test_ts --> n_src_utils_apiResponseParser_ts
  n_src_services_speechVoices_test_ts --> n_src_utils_apiClientInterceptors_ts
  n_src_services_speechVoices_test_ts --> n_src_services_speechVoices_ts
  n_src_services_speechVoices_test_ts --> n_src_utils_apiClient_ts
  n_src_services_speechVoices_test_ts --> n_src_services_auth_ts
  n_src_services_speechVoices_ts --> n_src_services_IPlatformService_ts
  n_src_services_speechVoices_ts --> n_src_utils_apiClient_ts
  n_src_services_speechVoices_ts --> n_src_services_auth_ts
  n_src_services_speechVoices_ts --> n_src_utils_storage_types_ts
  n_src_services_speechVoices_ts --> n_src_services_platformService_ts
  n_src_services_stubsService_test_ts --> n_src_services_stubsService_ts
  n_src_services_stubsService_test_ts --> n_src_utils_apiClient_ts
  n_src_services_stubsService_ts --> n_src_services_IPlatformService_ts
  n_src_services_stubsService_ts --> n_src_utils_apiClient_ts
  n_src_services_stubsService_ts --> n_src_types_ts
  n_src_services_stubsService_ts --> n_src_utils_logger_ts
  n_src_services_stubsService_ts --> n_src_services_platformService_ts
  n_src_services_themeService_test_ts --> n_src_services_themeService_ts
  n_src_services_themeService_ts --> n_src_services_IPlatformService_ts
  n_src_services_themeService_ts --> n_src_services_platformService_ts
  n_src_services_themeService_ts --> n_src_utils_storage_types_ts
  n_src_services_themeService_ts --> n_src_utils_observable_ts
  n_src_services_windowSecurityService_ts --> n_src_services_IPlatformService_ts
  n_src_services_windowSecurityService_ts --> n_src_utils_observable_ts
  n_src_services_windowSecurityService_ts --> n_src_utils_storage_general_ts
  n_src_services_windowSecurityService_ts --> n_src_services_platformService_ts
  n_src_utils_apiClient_ts --> n_src_utils_urlUtils_ts
  n_src_utils_apiClient_ts --> n_src_utils_apiClientErrors_ts
  n_src_utils_apiClient_ts --> n_src_utils_apiClientInterceptors_ts
  n_src_utils_apiClient_ts --> n_src_utils_apiClientRetry_ts
  n_src_utils_apiClient_ts --> n_src_utils_apiResponseParser_ts
  n_src_utils_apiClientErrors_ts --> n_src_utils_errorHandling_ts
  n_src_utils_apiClientInterceptors_test_ts --> n_src_utils_apiClientInterceptors_ts
  n_src_utils_apiClientRetry_test_ts --> n_src_utils_apiClientRetry_ts
  n_src_utils_apiClientRetry_test_ts --> n_src_utils_apiClientErrors_ts
  n_src_utils_apiClientRetry_test_ts --> n_src_utils_delayStrategy_ts
  n_src_utils_apiClientRetry_ts --> n_src_services_IPlatformService_ts
  n_src_utils_apiClientRetry_ts --> n_src_utils_apiClientErrors_ts
  n_src_utils_apiClientRetry_ts --> n_src_utils_delayStrategy_ts
  n_src_utils_apiClientRetry_ts --> n_src_services_platformService_ts
  n_src_utils_apiResponseParser_test_ts --> n_src_utils_apiResponseParser_ts
  n_src_utils_apiResponseParser_test_ts --> n_src_utils_apiClientErrors_ts
  n_src_utils_apiResponseParser_ts --> n_src_utils_apiClientErrors_ts
  n_src_utils_asyncStorage_test_ts --> n_src_utils_asyncStorage_ts
  n_src_utils_asyncStorage_test_ts --> n_src_utils_logger_ts
  n_src_utils_asyncStorage_ts --> n_src_utils_logger_ts
  n_src_utils_batchSelectionManager_test_ts --> n_src_utils_batchSelectionManager_ts
  n_src_utils_batchSelectionManager_ts --> n_src_utils_observable_ts
  n_src_utils_batchSelectionManager_ts --> n_src_utils_storage_helpers_ts
  n_src_utils_computedStore_test_ts --> n_src_utils_observable_ts
  n_src_utils_computedStore_test_ts --> n_src_utils_computedStore_ts
  n_src_utils_computedStore_ts --> n_src_utils_observable_ts
  n_src_utils_crossTabNotifier_BroadcastChannelNotifier_ts --> n_src_services_IPlatformService_ts
  n_src_utils_crossTabNotifier_BroadcastChannelNotifier_ts --> n_src_utils_crossTabNotifier_types_ts
  n_src_utils_crossTabNotifier_BroadcastChannelNotifier_ts --> n_src_utils_logger_ts
  n_src_utils_crossTabNotifier_CrossTabNotifier_test_ts --> n_src_services_IPlatformService_ts
  n_src_utils_crossTabNotifier_CrossTabNotifier_test_ts --> n_src_utils_crossTabNotifier_StorageEventNotifier_ts
  n_src_utils_crossTabNotifier_CrossTabNotifier_test_ts --> n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts
  n_src_utils_crossTabNotifier_CrossTabNotifier_test_ts --> n_src_utils_logger_ts
  n_src_utils_crossTabNotifier_CrossTabNotifier_test_ts --> n_src_utils_testUtils_storageEvent_ts
  n_src_utils_crossTabNotifier_CrossTabNotifier_test_ts --> n_src_utils_crossTabNotifier_FallbackCrossTabNotifier_ts
  n_src_utils_crossTabNotifier_CrossTabNotifier_test_ts --> n_src_utils_crossTabNotifier_BroadcastChannelNotifier_ts
  n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts --> n_src_utils_crossTabNotifier_types_ts
  n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts --> n_src_utils_crossTabNotifier_BroadcastChannelNotifier_ts
  n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts --> n_src_utils_crossTabNotifier_StorageEventNotifier_ts
  n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts --> n_src_utils_crossTabNotifier_FallbackCrossTabNotifier_ts
  n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts --> n_src_utils_logger_ts
  n_src_utils_crossTabNotifier_FallbackCrossTabNotifier_ts --> n_src_utils_crossTabNotifier_types_ts
  n_src_utils_crossTabNotifier_FallbackCrossTabNotifier_ts --> n_src_utils_logger_ts
  n_src_utils_crossTabNotifier_StorageEventNotifier_ts --> n_src_services_IPlatformService_ts
  n_src_utils_crossTabNotifier_StorageEventNotifier_ts --> n_src_utils_timeProvider_ts
  n_src_utils_crossTabNotifier_StorageEventNotifier_ts --> n_src_utils_crossTabNotifier_types_ts
  n_src_utils_crossTabNotifier_StorageEventNotifier_ts --> n_src_utils_logger_ts
  n_src_utils_crossTabNotifier_StorageEventNotifier_ts --> n_src_utils_storage_serializer_JsonSerializer_ts
  n_src_utils_crossTabNotifier_StorageEventNotifier_ts --> n_src_utils_storage_serializer_types_ts
  n_src_utils_crossTabNotifier_types_ts --> n_src_services_IPlatformService_ts
  n_src_utils_crossTabNotifier_types_ts --> n_src_utils_logger_ts
  n_src_utils_crossTabNotifier_types_ts --> n_src_utils_timeProvider_ts
  n_src_utils_crossTabNotifier_types_ts --> n_src_utils_storage_serializer_types_ts
  n_src_utils_delayStrategy_test_ts --> n_src_utils_delayStrategy_ts
  n_src_utils_delayStrategy_ts --> n_src_utils_randomProvider_ts
  n_src_utils_errorHandling_test_ts --> n_src_utils_errorHandling_ts
  n_src_utils_eventEmitter_test_ts --> n_src_utils_eventEmitter_ts
  n_src_utils_eventEmitter_ts --> n_src_utils_logger_ts
  n_src_utils_idGenerator_test_ts --> n_src_utils_idGenerator_ts
  n_src_utils_idGenerator_ts --> n_src_utils_timeProvider_ts
  n_src_utils_idGenerator_ts --> n_src_utils_randomProvider_ts
  n_src_utils_imageCompressor_test_ts --> n_src_services_IPlatformService_ts
  n_src_utils_imageCompressor_test_ts --> n_src_utils_imageCompressor_ts
  n_src_utils_imageCompressor_test_ts --> n_src_types_ts
  n_src_utils_imageCompressor_ts --> n_src_services_IPlatformService_ts
  n_src_utils_imageCompressor_ts --> n_src_types_ts
  n_src_utils_imageCompressor_ts --> n_src_utils_idGenerator_ts
  n_src_utils_imageCompressor_ts --> n_src_services_platformService_ts
  n_src_utils_logger_test_ts --> n_src_utils_logger_ts
  n_src_utils_modelCatalog_ts --> n_src_types_ts
  n_src_utils_modelCatalog_ts --> n_src_utils_apiClient_ts
  n_src_utils_mutex_ts --> n_src_services_IPlatformService_ts
  n_src_utils_mutex_ts --> n_src_utils_logger_ts
  n_src_utils_networkStatus_ts --> n_src_services_IPlatformService_ts
  n_src_utils_networkStatus_ts --> n_src_utils_observable_ts
  n_src_utils_networkStatus_ts --> n_src_services_platformService_ts
  n_src_utils_observable_ts --> n_src_utils_logger_ts
  n_src_utils_observableBatching_test_ts --> n_src_utils_observable_ts
  n_src_utils_offlineQueueStore_test_ts --> n_src_utils_offlineQueueStore_ts
  n_src_utils_offlineQueueStore_test_ts --> n_src_utils_asyncStorage_ts
  n_src_utils_offlineQueueStore_test_ts --> n_src_utils_logger_ts
  n_src_utils_offlineQueueStore_test_ts --> n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts
  n_src_utils_offlineQueueStore_test_ts --> n_src_services_platformService_ts
  n_src_utils_offlineQueueStore_ts --> n_src_services_IPlatformService_ts
  n_src_utils_offlineQueueStore_ts --> n_src_utils_mutex_ts
  n_src_utils_offlineQueueStore_ts --> n_src_utils_observable_ts
  n_src_utils_offlineQueueStore_ts --> n_src_utils_logger_ts
  n_src_utils_offlineQueueStore_ts --> n_src_utils_offlineService_ts
  n_src_utils_offlineQueueStore_ts --> n_src_utils_storage_helpers_ts
  n_src_utils_offlineQueueStore_ts --> n_src_utils_asyncStorage_ts
  n_src_utils_offlineService_test_ts --> n_src_utils_offlineService_ts
  n_src_utils_offlineService_test_ts --> n_src_utils_asyncStorage_ts
  n_src_utils_offlineService_test_ts --> n_src_utils_logger_ts
  n_src_utils_offlineService_test_ts --> n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts
  n_src_utils_offlineService_test_ts --> n_src_services_platformService_ts
  n_src_utils_offlineService_ts --> n_src_services_IPlatformService_ts
  n_src_utils_offlineService_ts --> n_src_utils_observable_ts
  n_src_utils_offlineService_ts --> n_src_utils_asyncStorage_ts
  n_src_utils_offlineService_ts --> n_src_utils_logger_ts
  n_src_utils_offlineService_ts --> n_src_utils_offlineQueueStore_ts
  n_src_utils_offlineService_ts --> n_src_utils_syncEngine_ts
  n_src_utils_offlineService_ts --> n_src_utils_idGenerator_ts
  n_src_utils_offlineService_ts --> n_src_utils_timeProvider_ts
  n_src_utils_polling_test_ts --> n_src_utils_polling_ts
  n_src_utils_polling_ts --> n_src_services_IPlatformService_ts
  n_src_utils_polling_ts --> n_src_utils_delayStrategy_ts
  n_src_utils_polling_ts --> n_src_services_platformService_ts
  n_src_utils_randomProvider_test_ts --> n_src_utils_randomProvider_ts
  n_src_utils_speechExtractor_test_ts --> n_src_utils_speechExtractor_ts
  n_src_utils_sseParser_test_ts --> n_src_utils_sseParser_ts
  n_src_utils_storage_ActiveItemManager_test_ts --> n_src_utils_storage_ActiveItemManager_ts
  n_src_utils_storage_ActiveItemManager_test_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_ActiveItemManager_test_ts --> n_src_utils_storage_selectionStrategy_ts
  n_src_utils_storage_ActiveItemManager_ts --> n_src_utils_observable_ts
  n_src_utils_storage_ActiveItemManager_ts --> n_src_utils_computedStore_ts
  n_src_utils_storage_ActiveItemManager_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_ActiveItemManager_ts --> n_src_utils_storage_selectionStrategy_ts
  n_src_utils_storage_ActiveItemManagerFactory_ts --> n_src_utils_storage_ActiveItemManager_ts
  n_src_utils_storage_ActiveItemManagerFactory_ts --> n_src_utils_storage_StorageCollection_ts
  n_src_utils_storage_ActiveItemManagerFactory_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_ActiveItemManagerFactory_ts --> n_src_utils_storage_StorageSingleton_ts
  n_src_utils_storage_ActiveItemManagerFactory_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_ActiveItemManagerFactory_ts --> n_src_utils_storage_selectionStrategy_ts
  n_src_utils_storage_FallbackStorageWrapper_test_ts --> n_src_utils_storage_FallbackStorageWrapper_ts
  n_src_utils_storage_FallbackStorageWrapper_test_ts --> n_src_utils_logger_ts
  n_src_utils_storage_FallbackStorageWrapper_ts --> n_src_services_IPlatformService_ts
  n_src_utils_storage_FallbackStorageWrapper_ts --> n_src_utils_storage_core_ts
  n_src_utils_storage_FallbackStorageWrapper_ts --> n_src_services_platformService_ts
  n_src_utils_storage_FallbackStorageWrapper_ts --> n_src_utils_eventEmitter_ts
  n_src_utils_storage_FallbackStorageWrapper_ts --> n_src_utils_logger_ts
  n_src_utils_storage_MapCollection_test_ts --> n_src_utils_storage_MapCollection_ts
  n_src_utils_storage_MapCollection_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_MapCollection_ts --> n_src_utils_storage_helpers_ts
  n_src_utils_storage_StorageBase_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_StorageBase_ts --> n_src_utils_observable_ts
  n_src_utils_storage_StorageBase_ts --> n_src_utils_logger_ts
  n_src_utils_storage_StorageBase_ts --> n_src_utils_storage_helpers_ts
  n_src_utils_storage_StorageBase_ts --> n_src_utils_eventEmitter_ts
  n_src_utils_storage_StorageCollection_test_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_StorageCollection_ts --> n_src_utils_storage_StorageBase_ts
  n_src_utils_storage_StorageCollection_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_StorageCollection_ts --> n_src_utils_eventEmitter_ts
  n_src_utils_storage_StorageCollection_ts --> n_src_utils_logger_ts
  n_src_utils_storage_StorageFactory_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_StorageFactory_ts --> n_src_utils_storage_StorageCollection_ts
  n_src_utils_storage_StorageFactory_ts --> n_src_utils_storage_StorageSingleton_ts
  n_src_utils_storage_StorageFactory_ts --> n_src_utils_storage_StorageRegistry_ts
  n_src_utils_storage_StorageFactory_ts --> n_src_utils_storage_MapCollection_ts
  n_src_utils_storage_StorageFactory_ts --> n_src_utils_storage_core_ts
  n_src_utils_storage_StorageFactory_ts --> n_src_utils_logger_ts
  n_src_utils_storage_StorageRegistry_test_ts --> n_src_utils_storage_StorageRegistry_ts
  n_src_utils_storage_StorageSingleton_test_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_StorageSingleton_test_ts --> n_src_utils_storage_core_ts
  n_src_utils_storage_StorageSingleton_ts --> n_src_utils_storage_StorageBase_ts
  n_src_utils_storage_StorageSingleton_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_core_ts --> n_src_services_IPlatformService_ts
  n_src_utils_storage_core_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_core_ts --> n_src_utils_storage_FallbackStorageWrapper_ts
  n_src_utils_storage_core_ts --> n_src_utils_logger_ts
  n_src_utils_storage_core_ts --> n_src_services_platformService_ts
  n_src_utils_storage_draftState_test_ts --> n_src_utils_storage_draftState_ts
  n_src_utils_storage_draftState_test_ts --> n_src_utils_storage_StorageRegistry_ts
  n_src_utils_storage_draftState_test_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_draftState_test_ts --> n_src_data_templates_ts
  n_src_utils_storage_draftState_test_ts --> n_src_utils_storage_constants_ts
  n_src_utils_storage_draftState_test_ts --> n_src_utils_logger_ts
  n_src_utils_storage_general_test_ts --> n_src_utils_storage_general_ts
  n_src_utils_storage_general_test_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_general_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_general_ts --> n_src_utils_storage_constants_ts
  n_src_utils_storage_general_ts --> n_src_utils_storage_core_ts
  n_src_utils_storage_general_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_general_ts --> n_src_utils_observable_ts
  n_src_utils_storage_helpers_test_ts --> n_src_utils_storage_helpers_ts
  n_src_utils_storage_jules_ts --> n_src_types_ts
  n_src_utils_storage_jules_ts --> n_src_utils_storage_constants_ts
  n_src_utils_storage_jules_ts --> n_src_utils_storage_encryption_ts
  n_src_utils_storage_jules_ts --> n_src_utils_mockDefinitions_ts
  n_src_utils_storage_jules_ts --> n_src_utils_storage_helpers_ts
  n_src_utils_storage_jules_ts --> n_src_utils_apiClient_ts
  n_src_utils_storage_jules_ts --> n_src_utils_storage_ActiveItemManagerFactory_ts
  n_src_utils_storage_jules_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_jules_ts --> n_src_utils_logger_ts
  n_src_utils_storage_jules_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_jules_ts --> n_src_utils_storage_ActiveItemManager_ts
  n_src_utils_storage_jules_ts --> n_src_utils_storage_syncAdapter_ts
  n_src_utils_storage_jules_ts --> n_src_utils_idGenerator_ts
  n_src_utils_storage_jules_ts --> n_src_utils_timeProvider_ts
  n_src_utils_storage_offlineRetryStrategy_test_ts --> n_src_utils_storage_offlineRetryStrategy_ts
  n_src_utils_storage_offlineRetryStrategy_test_ts --> n_src_utils_apiClientErrors_ts
  n_src_utils_storage_offlineRetryStrategy_ts --> n_src_utils_apiClientErrors_ts
  n_src_utils_storage_projects_test_ts --> n_src_utils_storage_projects_ts
  n_src_utils_storage_projects_test_ts --> n_src_utils_storage_ActiveItemManager_ts
  n_src_utils_storage_projects_test_ts --> n_src_types_ts
  n_src_utils_storage_projects_test_ts --> n_src_utils_storage_general_ts
  n_src_utils_storage_projects_ts --> n_src_types_ts
  n_src_utils_storage_projects_ts --> n_src_utils_idGenerator_ts
  n_src_utils_storage_projects_ts --> n_src_utils_storage_constants_ts
  n_src_utils_storage_projects_ts --> n_src_utils_storage_core_ts
  n_src_utils_storage_projects_ts --> n_src_utils_storage_encryption_ts
  n_src_utils_storage_projects_ts --> n_src_utils_storage_ActiveItemManagerFactory_ts
  n_src_utils_storage_projects_ts --> n_src_utils_storage_general_ts
  n_src_utils_storage_projects_ts --> n_src_utils_storage_ActiveItemManager_ts
  n_src_utils_storage_projects_ts --> n_src_utils_timeProvider_ts
  n_src_utils_storage_projects_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_prompts_ts --> n_src_types_ts
  n_src_utils_storage_prompts_ts --> n_src_utils_storage_ActiveItemManagerFactory_ts
  n_src_utils_storage_prompts_ts --> n_src_utils_storage_constants_ts
  n_src_utils_storage_prompts_ts --> n_src_utils_storage_ActiveItemManager_ts
  n_src_utils_storage_prompts_ts --> n_src_utils_storage_syncAdapter_ts
  n_src_utils_storage_prompts_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_selectionStrategy_test_ts --> n_src_utils_storage_selectionStrategy_ts
  n_src_utils_storage_serializer_JsonSerializer_test_ts --> n_src_utils_storage_serializer_JsonSerializer_ts
  n_src_utils_storage_serializer_JsonSerializer_ts --> n_src_utils_storage_serializer_types_ts
  n_src_utils_storage_syncAdapter_test_ts --> n_src_utils_storage_syncAdapter_ts
  n_src_utils_storage_syncAdapter_test_ts --> n_src_utils_apiClient_ts
  n_src_utils_storage_syncAdapter_test_ts --> n_src_utils_offlineService_ts
  n_src_utils_storage_syncAdapter_test_ts --> n_src_utils_networkStatus_ts
  n_src_utils_storage_syncAdapter_test_ts --> n_src_utils_observable_ts
  n_src_utils_storage_syncAdapter_test_ts --> n_src_utils_logger_ts
  n_src_utils_storage_syncAdapter_test_ts --> n_src_utils_storage_offlineRetryStrategy_ts
  n_src_utils_storage_syncAdapter_ts --> n_src_utils_offlineService_ts
  n_src_utils_storage_syncAdapter_ts --> n_src_utils_apiClient_ts
  n_src_utils_storage_syncAdapter_ts --> n_src_utils_networkStatus_ts
  n_src_utils_storage_syncAdapter_ts --> n_src_utils_storage_offlineRetryStrategy_ts
  n_src_utils_storage_syncAdapter_ts --> n_src_utils_logger_ts
  n_src_utils_storage_syncAdapter_ts --> n_src_utils_storage_syncAdapterErrors_ts
  n_src_utils_storage_syncAdapterErrors_ts --> n_src_utils_apiClientErrors_ts
  n_src_utils_storage_syncAdapterFormData_test_ts --> n_src_utils_storage_syncAdapterFormData_ts
  n_src_utils_storage_syncAdapterFormData_test_ts --> n_src_utils_apiClient_ts
  n_src_utils_storage_syncAdapterFormData_ts --> n_src_utils_apiClient_ts
  n_src_utils_storage_syncAdapterFormData_ts --> n_src_utils_storage_syncAdapter_ts
  n_src_utils_storage_types_ts --> n_src_utils_observable_ts
  n_src_utils_storage_test_ts --> n_src_utils_logger_ts
  n_src_utils_storage_test_ts --> n_src_utils_storage_core_ts
  n_src_utils_storage_test_ts --> n_src_utils_storage_draftState_ts
  n_src_utils_syncEngine_test_ts --> n_src_utils_syncEngine_ts
  n_src_utils_syncEngine_test_ts --> n_src_utils_offlineQueueStore_ts
  n_src_utils_syncEngine_test_ts --> n_src_utils_logger_ts
  n_src_utils_syncEngine_test_ts --> n_src_utils_offlineService_ts
  n_src_utils_syncEngine_ts --> n_src_utils_offlineQueueStore_ts
  n_src_utils_syncEngine_ts --> n_src_utils_logger_ts
  n_src_utils_syncEngine_ts --> n_src_utils_offlineService_ts
  n_src_utils_syncEngine_ts --> n_src_utils_syncEngineStrategy_ts
  n_src_utils_syncEngineStrategy_ts --> n_src_utils_logger_ts
  n_src_utils_syncEngineStrategy_ts --> n_src_utils_offlineService_ts
  n_src_utils_syncOrchestrator_ts --> n_src_utils_offlineService_ts
  n_src_utils_syncOrchestrator_ts --> n_src_utils_apiClient_ts
  n_src_utils_timeProvider_test_ts --> n_src_utils_timeProvider_ts
  n_src_utils_urlUtils_test_ts --> n_src_utils_urlUtils_ts
  n_src_utils_urlUtils_ts --> n_src_services_IPlatformService_ts
  n_src_utils_urlUtils_ts --> n_src_services_platformService_ts
  n_src_App_tsx --> n_src_types_ts
  n_src_App_tsx --> n_src_components_TopAppBar_tsx
  n_src_App_tsx --> n_src_components_WorkspaceRouter_tsx
  n_src_App_tsx --> n_src_components_TunerBottomSheet_tsx
  n_src_App_tsx --> n_src_components_UnifiedSettingsModal_tsx
  n_src_App_tsx --> n_src_components_AndroidFrame_tsx
  n_src_App_tsx --> n_src_components_BottomNavBar_tsx
  n_src_App_tsx --> n_src_components_CustomTabBrowserModal_tsx
  n_src_App_tsx --> n_src_components_ImportProjectSheet_tsx
  n_src_App_tsx --> n_src_components_SecurePrivacyShield_tsx
  n_src_App_tsx --> n_src_components_ClipboardKeyBanner_tsx
  n_src_App_tsx --> n_src_components_AuthRequiredBanner_tsx
  n_src_App_tsx --> n_src_components_StreamErrorBanner_tsx
  n_src_App_tsx --> n_src_contexts_WorkspaceContext_tsx
  n_src_App_tsx --> n_src_hooks_useGeminiStream_ts
  n_src_App_tsx --> n_src_hooks_useNetworkStatus_ts
  n_src_App_tsx --> n_src_hooks_useClipboardKeySniffer_ts
  n_src_App_tsx --> n_src_hooks_useWindowSecurity_ts
  n_src_App_tsx --> n_src_components_OfflineIndicator_tsx
  n_src_App_tsx --> n_src_hooks_useAppState_ts
  n_src_App_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_BottomNavBar_tsx --> n_src_types_ts
  n_src_components_BottomNavBar_tsx --> n_src_components_ui_Drawer_tsx
  n_src_components_BottomNavBar_tsx --> n_src_components_WorkspaceNavConfig_ts
  n_src_components_BottomNavBar_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_ChatHistoryPopover_tsx --> n_src_types_ts
  n_src_components_ChatHistoryPopover_tsx --> n_src_components_BatchSelectionHeader_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_contexts_WorkspaceContext_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_components_ChatHistoryPopover_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_hooks_useBatchSelection_ts
  n_src_components_ChatWorkspace_tsx --> n_src_components_BatchDeleteOverlay_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_utils_speechExtractor_ts
  n_src_components_ChatWorkspace_tsx --> n_src_services_speechVoices_ts
  n_src_components_ChatWorkspace_tsx --> n_src_services_sentenceSpeechQueue_ts
  n_src_components_ChatWorkspace_tsx --> n_src_hooks_useSpeechToText_ts
  n_src_components_ChatWorkspace_tsx --> n_src_hooks_useStore_ts
  n_src_components_ChatWorkspace_tsx --> n_src_components_GoogleIcon_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_components_PromptTemplateDrawer_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_types_ts
  n_src_components_CustomTabBrowserModal_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_CustomTabBrowserModal_tsx --> n_src_hooks_useBackNavigation_ts
  n_src_components_MobileIDE_test_ts --> n_src_types_ts
  n_src_components_MobileIDE_test_ts --> n_src_services_codeGeneratorService_ts
  n_src_components_StubsWorkspace_tsx --> n_src_utils_errorHandling_ts
  n_src_components_StubsWorkspace_tsx --> n_src_components_stubs_StubsTerminalTab_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_components_stubs_StubsLintTab_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_components_stubs_StubsGraphTab_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_components_stubs_StubsDiagramTab_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_components_stubs_StubsImpactTab_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_components_stubs_StubsSpecsTab_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_hooks_stubs_useStubsTerminal_ts
  n_src_components_StubsWorkspace_tsx --> n_src_hooks_stubs_useStubsData_ts
  n_src_components_StubsWorkspace_tsx --> n_src_hooks_stubs_useStubsSpecs_ts
  n_src_components_StubsWorkspace_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_contexts_WorkspaceContext_tsx
  n_src_components_TopAppBar_tsx --> n_src_types_ts
  n_src_components_TopAppBar_tsx --> n_src_hooks_useTheme_ts
  n_src_components_TopAppBar_tsx --> n_src_hooks_useGoogleAuth_ts
  n_src_components_TopAppBar_tsx --> n_src_components_TokenCounterVisualization_tsx
  n_src_components_TopAppBar_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_TopAppBar_tsx --> n_src_components_PWAInstallButton_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_hooks_settings_useSettingsProjectsState_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_settings_SettingsAudioTab_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_settings_SettingsSidebar_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_settings_SettingsTabsConfig_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_tuner_TunerConfigPanel_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_services_speechVoices_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_LibraryModal_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_CodeExportModal_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_DesktopWrapperGuide_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_hooks_useTheme_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_settings_SettingsDisplayTab_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_settings_SettingsAccountTab_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_settings_SettingsSecurityTab_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_hooks_useBackNavigation_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_types_ts
  n_src_components_WorkspaceNavConfig_ts --> n_src_types_ts
  n_src_components_WorkspaceRouter_tsx --> n_src_components_ChatWorkspace_tsx
  n_src_components_WorkspaceRouter_tsx --> n_src_components_MobileIDEWorkspace_tsx
  n_src_components_WorkspaceRouter_tsx --> n_src_types_ts
  n_src_components_WorkspaceRouter_tsx --> n_src_components_StubsWorkspace_tsx
  n_src_components_settings_AIStudioKeySection_tsx --> n_src_components_settings_SettingsSectionCard_tsx
  n_src_components_settings_SettingsAccountTab_tsx --> n_src_types_ts
  n_src_components_settings_SettingsAccountTab_tsx --> n_src_hooks_useOfflineQueue_ts
  n_src_components_settings_SettingsAccountTab_tsx --> n_src_components_GoogleAuthCard_tsx
  n_src_components_settings_SettingsAccountTab_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_settings_SettingsAccountTab_tsx --> n_src_components_settings_ServerConfigSection_tsx
  n_src_components_settings_SettingsAccountTab_tsx --> n_src_components_settings_AIStudioKeySection_tsx
  n_src_components_settings_SettingsAccountTab_tsx --> n_src_components_settings_ActiveProjectsSection_tsx
  n_src_hooks_useAppState_ts --> n_src_services_ServiceContext_tsx
  n_src_hooks_useAppState_ts --> n_src_hooks_useAppAuth_ts
  n_src_hooks_useAppState_ts --> n_src_hooks_usePromptTemplates_ts
  n_src_hooks_useAppState_ts --> n_src_hooks_useChatSession_ts
  n_src_hooks_useAppState_ts --> n_src_hooks_useProjectManager_ts
  n_src_hooks_useAppState_ts --> n_src_hooks_useUIState_ts
  n_src_hooks_useAppState_ts --> n_src_hooks_useModelConfig_ts
  n_src_hooks_useAppState_ts --> n_src_types_ts
  n_src_hooks_useUIState_ts --> n_src_types_ts
  n_src_hooks_useUIState_ts --> n_src_services_speechVoices_ts
  n_src_hooks_useUIState_ts --> n_src_services_ServiceContext_tsx
  n_src_services_ServiceContext_tsx --> n_src_services_IPlatformService_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_urlUtils_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_apiResponseParser_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_apiClientInterceptors_ts
  n_src_services_ServiceContext_tsx --> n_src_services_appAuthManager_ts
  n_src_services_ServiceContext_tsx --> n_src_services_platformService_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_apiClient_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_syncOrchestrator_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_syncRegistry_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_storage_syncAdapter_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_crossTabNotifier_CrossTabNotifierFactory_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_logger_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_idGenerator_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_timeProvider_ts
  n_src_services_ServiceContext_tsx --> n_src_services_themeService_ts
  n_src_services_ServiceContext_tsx --> n_src_services_promptTemplateService_ts
  n_src_services_ServiceContext_tsx --> n_src_services_auth_ts
  n_src_services_ServiceContext_tsx --> n_src_services_googleAuth_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_offlineService_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_networkStatus_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_storage_offlineRetryStrategy_ts
  n_src_services_ServiceContext_tsx --> n_src_services_chatHistoryService_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_storage_projects_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_storage_prompts_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_storage_general_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_storage_draftState_ts
  n_src_services_ServiceContext_tsx --> n_src_services_speechVoices_ts
  n_src_services_ServiceContext_tsx --> n_src_services_sentenceSpeechQueue_ts
  n_src_services_ServiceContext_tsx --> n_src_services_geminiStreamService_ts
  n_src_services_ServiceContext_tsx --> n_src_services_keyVerification_ts
  n_src_services_ServiceContext_tsx --> n_src_services_stubsService_ts
  n_src_services_ServiceContext_tsx --> n_src_services_codeGeneratorService_ts
  n_src_services_ServiceContext_tsx --> n_src_services_pwaInstallService_ts
  n_src_services_ServiceContext_tsx --> n_src_services_windowSecurityService_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_imageCompressor_ts
  n_src_services_ServiceContext_tsx --> n_src_services_clipboardService_ts
  n_src_services_ServiceContext_tsx --> n_src_services_fileDownloadService_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_sseParser_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_offlineQueueStore_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_asyncStorage_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_mutex_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_apiClientRetry_ts
  n_src_services_ServiceContext_tsx --> n_src_utils_batchSelectionManager_ts
  n_src_services_keyVerification_ts --> n_src_utils_timeProvider_ts
  n_src_services_keyVerification_ts --> n_src_utils_errorHandling_ts
  n_src_services_keyVerification_ts --> n_src_types_ts
  n_src_services_keyVerification_ts --> n_src_utils_apiClient_ts
  n_src_services_keyVerification_ts --> n_src_utils_logger_ts
  n_src_services_keyVerification_ts --> n_src_services_clipboardService_ts
  n_src_utils_storage_draftState_ts --> n_src_types_ts
  n_src_utils_storage_draftState_ts --> n_src_data_templates_ts
  n_src_utils_storage_draftState_ts --> n_src_utils_storage_StorageFactory_ts
  n_src_utils_storage_draftState_ts --> n_src_utils_storage_StorageRegistry_ts
  n_src_utils_storage_draftState_ts --> n_src_utils_storage_types_ts
  n_src_utils_storage_draftState_ts --> n_src_utils_storage_constants_ts
  n_src_utils_storage_draftState_ts --> n_src_utils_storage_helpers_ts
  n_src_utils_storage_draftState_ts --> n_src_utils_logger_ts
  n_src_utils_storage_draftState_ts --> n_src_utils_timeProvider_ts
  n_src_utils_storage_helpers_ts --> n_src_utils_mockDefinitions_ts
  n_src_utils_storage_index_ts --> n_src_utils_storage_StorageCollection_ts
  n_src_utils_storage_index_ts --> n_src_utils_storage_MapCollection_ts
  n_src_utils_storage_index_ts --> n_src_utils_storage_StorageSingleton_ts
  n_src_utils_syncRegistry_ts --> n_src_utils_syncOrchestrator_ts
  n_src_utils_syncRegistry_ts --> n_src_utils_offlineService_ts
  n_src_utils_syncRegistry_ts --> n_src_utils_apiClient_ts
```
