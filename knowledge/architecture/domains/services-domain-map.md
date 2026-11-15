---
title: Services Domain — Domain Context Map
type: domain-context-map
domain: services
parent_map: ../context-map.md
description: Deep-dive context map for the services domain, subsystem responsibilities, and internal modules.
tags:
  - domain-map
  - services
  - agent-optimized
---

# Services Domain — Domain Context Map

Parent Context Map: knowledge/architecture/context-map.md

## Domain Purpose & Responsibilities
The Services Domain coordinates domain logic, core types, and services for the services subsystem.

## Key Modules & Files
src/services/platformService.ts (Hub) -> deps: none | caps: BrowserPlatformService, getStorageEventObservable, getStorageQuotaObservable, isInputFocused, blurActiveElement, openUrl, reloadWindow, isKeyboardVisible
src/services/themeService.ts -> deps: none | caps: ThemeMode, ResolvedTheme, ThemeState, ThemeListener, IThemeService, ThemeServiceConfig, ThemeService, getSystemResolvedTheme
src/services/chatHistoryService.ts -> deps: none | caps: IChatHistoryService, ChatHistoryServiceConfig, ChatHistoryService, handleQuotaExceeded, getChatCollectionByKey, getChatCollection, getChatSessionsStorageKey, isMockChatSession
src/services/julesService.ts -> deps: none | caps: JulesTaskPayload, JulesServiceConfig, IJulesClient, JulesClient, setConfig, resolveApiKey, getSettings, verifyApiKey
src/services/stubsService.ts -> deps: none | caps: StubsDiagramResponse, StubsLintResponse, StubsSpecsResponse, StubsExecuteResponse, IStubsClient, StubsClientConfig, StubsClient, fetchGraphData
src/services/googleAuth.ts -> deps: none | caps: GoogleAuthServiceConfig, IGoogleAuthService, GoogleAuthService, setAuthProvider, getAccessToken, loadStoredGoogleUser, saveStoredGoogleUser, syncGoogleUserWithBackend
src/services/appAuthManager.ts -> deps: none | caps: IAppAuthManager, AppAuthManagerConfig, AppAuthManager, getGoogleUser, hasServerKey, getCustomApiKey, hasAnyApiKey, saveCustomApiKey
src/services/sentenceSpeechQueue.ts -> deps: none | caps: SentenceQueueOptions, ISentenceSpeechQueue, SentenceSpeechQueue, updateSettings, feed, finalize, enqueueSentence, startHeartbeat
src/services/geminiStreamService.ts -> deps: none | caps: StreamCallbacks, StreamOptions, GeminiApiError, IGeminiStreamService, GeminiStreamServiceConfig, GeminiStreamService, sanitizeLogMessage, sanitizeHeadersForLogging
src/services/julesSessionOrchestrator.ts -> deps: none | caps: OrchestratorState, IJulesSessionOrchestrator, JulesSessionOrchestratorConfig, JulesSessionOrchestrator, getStateStore, setState, stopPolling, clearMessages
src/services/promptTemplateService.ts -> deps: none | caps: IPromptTemplateService, PromptTemplateServiceConfig, PromptTemplateService, getBuiltinTemplates, getCustomTemplates, getAllTemplates, getTemplateById, saveCustomTemplate
src/services/speechVoices.ts -> deps: none | caps: GeminiVoiceOption, DeviceVoiceOption, SpeechSettings, ISpeechVoicesService, SpeechVoicesServiceConfig, SpeechVoicesService, fetchTTSAudioUrl, loadSpeechSettings
src/services/windowSecurityService.ts -> deps: none | caps: ShieldState, WindowSecurityServiceConfig, IWindowSecurityService, WindowSecurityService, clearScheduledTimer, updateShield, initListeners, setContext
src/services/keyVerification.ts -> deps: none | caps: IKeyVerificationService, KeyVerificationServiceConfig, KeyVerificationService, isValidGoogleApiKeyFormat, detectGoogleApiKey, maskApiKey, verifyGoogleApiKey, clearClipboardSafe
src/services/auth.ts -> deps: none | caps: IAuthService, AuthServiceConfig, AuthService, fetchAuthStatus, fetchServerHealth, getAuthHeaders
src/services/codeGeneratorService.ts -> deps: none | caps: ICodeGeneratorService, CodeGeneratorServiceConfig, CodeGeneratorService, registerGenerator, getGenerator, getAllGenerators
src/services/firebaseAuthProvider.ts -> deps: none | caps: FirebaseAuthProvider, getFirebaseAuth, getGoogleAuthProvider, signIn, signOut, onAuthStateChanged
src/services/pwaInstallService.ts -> deps: none | caps: BeforeInstallPromptEvent, PWAInstallState, PwaInstallServiceConfig, IPwaInstallService, PwaInstallService, initListeners
src/services/clipboardService.ts -> deps: none | caps: IClipboardService, BrowserClipboardService, readText, writeText
src/services/codeGenerators/BaseCodeGenerator.ts -> deps: none | caps: BaseCodeGenerator, escapeStringForCode, extractPromptContext, generate
src/services/fileDownloadService.ts -> deps: none | caps: IFileDownloadService, BrowserFileDownloadService, downloadText
src/services/ServiceContext.tsx -> deps: none | caps: IServices, useServices, createServices
src/services/authProvider.ts -> deps: none | caps: AuthSignInResult, IAuthProvider
src/services/codeGenerators/CurlGenerator.ts -> deps: none | caps: CurlGenerator, generate
src/services/codeGenerators/ICodeGeneratorPlugin.ts -> deps: none | caps: CodeLangId, ICodeGeneratorPlugin
src/services/codeGenerators/KotlinGenerator.ts -> deps: none | caps: KotlinGenerator, generate
src/services/codeGenerators/PythonGenerator.ts -> deps: none | caps: PythonGenerator, generate
src/services/codeGenerators/TypeScriptGenerator.ts -> deps: none | caps: TypeScriptGenerator, generate
src/services/IPlatformService.ts -> deps: none | caps: IPlatformService
src/services/chatHistoryService.ts.md -> deps: none | caps: internal
src/services/codeGenerators/index.ts -> deps: none | caps: internal
src/services/julesService.ts.md -> deps: none | caps: internal
src/services/promptTemplateService.ts.md -> deps: none | caps: internal
src/services/themeService.ts.md -> deps: none | caps: internal

## Domain Invariants
- Downward dependencies only: cross-domain calls must target canonical domain hubs.
- External consumers must interface through platformService.ts, never private internal helpers.
- State changes must adhere to lifecycle and containment invariants.
