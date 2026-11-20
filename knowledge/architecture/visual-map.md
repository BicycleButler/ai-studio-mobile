---
title: "Visual System Topology"
type: visual-diagram
status: active
domain: core
---

# Visual System Topology

Generated from live AST graph (307 modules, 1286 edges).

```mermaid
flowchart TD
  subgraph dom_services["Domain: services (45)"]
    style dom_services fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc
    n_src_services_ServiceContext_tsx["ServiceContext.tsx"]
    n_src_services_IPlatformService_ts["IPlatformService.ts"]
    n_src_services_platformService_ts["platformService.ts"]
    n_src_services_speechVoices_ts["speechVoices.ts"]
    n_src_services_geminiStreamService_ts["geminiStreamService.ts"]
    n_src_services_googleAuth_ts["googleAuth.ts"]
    n_src_services_chatHistoryService_ts["chatHistoryService.ts"]
    n_src_services_codeGenerators_index_ts["index.ts"]
    n_src_services_integrationService_ts["integrationService.ts"]
    n_src_services_promptTemplateService_ts["promptTemplateService.ts"]
    n_src_services_sentenceSpeechQueue_test_ts["sentenceSpeechQueue.test.ts"]
    n_src_services_stubsService_ts["stubsService.ts"]
    dom_services_more["+33 more modules"]
  end
  subgraph dom_core["Domain: core (9)"]
    style dom_core fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc
    n_src_types_ts["types.ts"]
    n_src_App_tsx["App.tsx"]
    n_src_types_integrations_ts["integrations.ts"]
    n_src_types_stubs_ts["stubs.ts"]
    n_src_main_tsx["main.tsx"]
    n_src_contexts_WorkspaceContext_tsx["WorkspaceContext.tsx"]
    n_src_schemas_validation_ts["validation.ts"]
    n_src_types_speechRecognition_ts["speechRecognition.ts"]
    n_src_schemas_validation_test_ts["validation.test.ts"]
  end
  subgraph dom_utils["Domain: utils (127)"]
    style dom_utils fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc
    n_src_utils_logger_ts["logger.ts"]
    n_src_utils_storage_index_ts["index.ts"]
    n_src_utils_apiClient_ts["apiClient.ts"]
    n_src_utils_offlineService_ts["offlineService.ts"]
    n_src_utils_observable_ts["observable.ts"]
    n_src_utils_storage_StorageFactory_ts["StorageFactory.ts"]
    n_src_utils_storage_types_ts["types.ts"]
    n_src_utils_errorHandling_ts["errorHandling.ts"]
    n_src_utils_timeProvider_ts["timeProvider.ts"]
    n_src_utils_storage_draftState_ts["draftState.ts"]
    n_src_utils_storage_projects_ts["projects.ts"]
    n_src_utils_storage_providers_ts["providers.ts"]
    dom_utils_more["+115 more modules"]
  end
  subgraph dom_components["Domain: components (80)"]
    style dom_components fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc
    n_src_components_UnifiedSettingsModal_tsx["UnifiedSettingsModal.tsx"]
    n_src_components_ChatWorkspace_tsx["ChatWorkspace.tsx"]
    n_src_components_StubsWorkspace_tsx["StubsWorkspace.tsx"]
    n_src_components_settings_SettingsAccountTab_tsx["SettingsAccountTab.tsx"]
    n_src_components_integrations_IntegrationsHubSection_tsx["IntegrationsHubSection.tsx"]
    n_src_components_MobileIDEWorkspace_tsx["MobileIDEWorkspace.tsx"]
    n_src_components_PromptTemplateDrawer_tsx["PromptTemplateDrawer.tsx"]
    n_src_components_integrations_IDERemoteSyncModal_tsx["IDERemoteSyncModal.tsx"]
    n_src_components_WorkspaceRouter_tsx["WorkspaceRouter.tsx"]
    n_src_components_LibraryModal_tsx["LibraryModal.tsx"]
    n_src_components_BatchDeleteOverlay_tsx["BatchDeleteOverlay.tsx"]
    n_src_components_TopAppBar_tsx["TopAppBar.tsx"]
    dom_components_more["+68 more modules"]
  end
  subgraph dom_server["Domain: server (12)"]
    style dom_server fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc
    n_server_ts["server.ts"]
    n_server_serverContext_ts["serverContext.ts"]
    n_server_stubsService_ts["stubsService.ts"]
    n_server_server_test_ts["server.test.ts"]
    n_server_stateStore_ts["stateStore.ts"]
    n_server_utils_integrations_ts["integrations.ts"]
    n_server_utils_providers_ts["providers.ts"]
    n_server_integrations_test_ts["integrations.test.ts"]
    n_server_performance_test_ts["performance.test.ts"]
    n_server_utils_processRunner_ts["processRunner.ts"]
    n_server_stubsService_test_ts["stubsService.test.ts"]
    n_server_utils_genai_ts["genai.ts"]
  end
  subgraph dom_hooks["Domain: hooks (34)"]
    style dom_hooks fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc
    n_src_hooks_useAppState_ts["useAppState.ts"]
    n_src_hooks_useOfflineSync_ts["useOfflineSync.ts"]
    n_src_hooks_useIntegrations_ts["useIntegrations.ts"]
    n_src_hooks_useProviderConnections_ts["useProviderConnections.ts"]
    n_src_hooks_useStore_ts["useStore.ts"]
    n_src_hooks_useBatchSelection_ts["useBatchSelection.ts"]
    n_src_hooks_useOfflineSync_test_tsx["useOfflineSync.test.tsx"]
    n_src_hooks_useGeminiStream_ts["useGeminiStream.ts"]
    n_src_hooks_useOfflineQueue_ts["useOfflineQueue.ts"]
    n_src_hooks_stubs_useStubsData_ts["useStubsData.ts"]
    n_src_hooks_useBackNavigation_ts["useBackNavigation.ts"]
    n_src_hooks_useChatSession_ts["useChatSession.ts"]
    dom_hooks_more["+22 more modules"]
  end
  n_server_ts --> n_server_serverContext_ts
  n_server_ts --> n_server_stateStore_ts
  n_server_ts --> n_src_schemas_validation_ts
  n_server_ts --> n_server_stubsService_ts
  n_server_ts --> n_server_utils_genai_ts
  n_server_ts --> n_server_utils_providers_ts
  n_server_ts --> n_server_utils_integrations_ts
  n_server_ts --> n_src_utils_errorHandling_ts
  n_server_ts --> n_src_types_ts
  n_server_ts --> n_src_types_integrations_ts
  n_server_integrations_test_ts --> n_server_ts
  n_server_integrations_test_ts --> n_server_stateStore_ts
  n_server_integrations_test_ts --> n_server_utils_integrations_ts
  n_server_performance_test_ts --> n_server_ts
  n_server_performance_test_ts --> n_server_stateStore_ts
  n_server_performance_test_ts --> n_server_utils_genai_ts
  n_server_server_test_ts --> n_server_ts
  n_server_server_test_ts --> n_server_stateStore_ts
  n_server_server_test_ts --> n_server_stubsService_ts
  n_server_server_test_ts --> n_server_utils_processRunner_ts
  n_server_serverContext_ts --> n_src_utils_apiClient_ts
  n_server_serverContext_ts --> n_src_utils_logger_ts
  n_server_serverContext_ts --> n_server_utils_processRunner_ts
  n_server_serverContext_ts --> n_src_utils_timeProvider_ts
  n_server_stubsService_test_ts --> n_server_stubsService_ts
  n_server_stubsService_test_ts --> n_src_types_stubs_ts
  n_server_stubsService_ts --> n_server_serverContext_ts
  n_server_stubsService_ts --> n_src_types_ts
  n_server_utils_integrations_ts --> n_src_types_integrations_ts
  n_server_utils_integrations_ts --> n_src_utils_errorHandling_ts
  n_server_utils_processRunner_ts --> n_src_utils_timeProvider_ts
  n_server_utils_providers_ts --> n_src_types_ts
  n_server_utils_providers_ts --> n_src_utils_errorHandling_ts
  n_src_App_tsx --> n_src_types_ts
  n_src_App_tsx --> n_src_types_integrations_ts
  n_src_App_tsx --> n_src_components_TopAppBar_tsx
  n_src_App_tsx --> n_src_components_WorkspaceRouter_tsx
  n_src_App_tsx --> n_src_contexts_WorkspaceContext_tsx
  n_src_App_tsx --> n_src_hooks_useGeminiStream_ts
  n_src_App_tsx --> n_src_hooks_useAppState_ts
  n_src_App_tsx --> n_src_services_ServiceContext_tsx
  n_src_App_tsx --> n_src_hooks_useProviderConnections_ts
  n_src_App_tsx --> n_src_components_UnifiedSettingsModal_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_contexts_WorkspaceContext_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_hooks_useBatchSelection_ts
  n_src_components_ChatWorkspace_tsx --> n_src_components_BatchDeleteOverlay_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_types_ts
  n_src_components_ChatWorkspace_tsx --> n_src_services_speechVoices_ts
  n_src_components_ChatWorkspace_tsx --> n_src_hooks_useStore_ts
  n_src_components_ChatWorkspace_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_ChatWorkspace_tsx --> n_src_components_PromptTemplateDrawer_tsx
  n_src_components_LibraryModal_tsx --> n_src_components_BatchDeleteOverlay_tsx
  n_src_components_LibraryModal_tsx --> n_src_types_ts
  n_src_components_LibraryModal_tsx --> n_src_hooks_useOfflineQueue_ts
  n_src_components_LibraryModal_tsx --> n_src_hooks_useBatchSelection_ts
  n_src_components_LibraryModal_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_MobileIDEWorkspace_tsx --> n_src_components_WorkspaceRouter_tsx
  n_src_components_MobileIDEWorkspace_tsx --> n_src_contexts_WorkspaceContext_tsx
  n_src_components_MobileIDEWorkspace_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_MobileIDEWorkspace_tsx --> n_src_components_integrations_IDERemoteSyncModal_tsx
  n_src_components_MobileIDEWorkspace_tsx --> n_src_types_stubs_ts
  n_src_components_MobileIDEWorkspace_tsx --> n_src_types_integrations_ts
  n_src_components_PromptTemplateDrawer_tsx --> n_src_types_ts
  n_src_components_PromptTemplateDrawer_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_PromptTemplateDrawer_tsx --> n_src_hooks_useBatchSelection_ts
  n_src_components_PromptTemplateDrawer_tsx --> n_src_components_BatchDeleteOverlay_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_utils_errorHandling_ts
  n_src_components_StubsWorkspace_tsx --> n_src_hooks_stubs_useStubsData_ts
  n_src_components_StubsWorkspace_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_contexts_WorkspaceContext_tsx
  n_src_components_StubsWorkspace_tsx --> n_src_types_stubs_ts
  n_src_components_TopAppBar_tsx --> n_src_types_ts
  n_src_components_TopAppBar_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_types_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_services_speechVoices_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_LibraryModal_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_settings_SettingsAccountTab_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_integrations_IntegrationsHubSection_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_components_WorkspaceRouter_tsx
  n_src_components_UnifiedSettingsModal_tsx --> n_src_types_integrations_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_hooks_useBackNavigation_ts
  n_src_components_UnifiedSettingsModal_tsx --> n_src_services_ServiceContext_tsx
  n_src_components_WorkspaceRouter_tsx --> n_src_components_ChatWorkspace_tsx
  n_src_components_WorkspaceRouter_tsx --> n_src_components_StubsWorkspace_tsx
  n_src_components_WorkspaceRouter_tsx --> n_src_types_ts
  n_src_components_WorkspaceRouter_tsx --> n_src_types_integrations_ts
  n_src_components_WorkspaceRouter_tsx --> n_src_components_MobileIDEWorkspace_tsx
  n_src_components_integrations_IDERemoteSyncModal_tsx --> n_src_types_integrations_ts
  n_src_components_integrations_IDERemoteSyncModal_tsx --> n_src_hooks_useIntegrations_ts
  n_src_components_integrations_IDERemoteSyncModal_tsx --> n_src_utils_errorHandling_ts
```
