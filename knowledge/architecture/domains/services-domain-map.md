---
title: "Services Domain Map"
type: domain-context-map
status: active
domain: services
layer: 2
---

# Services Domain Map

> Stateful business services, Stubs GraphRAG client, platform service facades, and Gemini/chat persistence engines.

## Domain Metrics & Canonical Hubs
- **Layer Tier**: Layer 2 (Domain Services)
- **Production Modules**: 32
- **Canonical Hubs**: `src/services/ServiceContext.tsx` (fan-in: 50, fan-out: 52), `src/services/IPlatformService.ts` (fan-in: 31, fan-out: 3), `src/services/platformService.ts` (fan-in: 25, fan-out: 5), `src/services/speechVoices.ts` (fan-in: 9, fan-out: 6)

## Module Inventory & Dependency Contracts
- `src/services/ServiceContext.tsx` (L2, 366L, fan-in:50) — `[deps: IPlatformService.ts, urlUtils.ts, apiResponseParser.ts, apiClientInterceptors.ts, appAuthManager.ts, platformService.ts]` · `[caps: IServices, ServiceProvider, useServices, createServices]`
- `src/services/IPlatformService.ts` (L2, 49L, fan-in:31) — `[deps: eventEmitter.ts, platform.ts, speechRecognition.ts]` · `[caps: IPlatformService]`
- `src/services/platformService.ts` (L2, 256L, fan-in:25) — `[deps: IPlatformService.ts, platform.ts, logger.ts, speechRecognition.ts, eventEmitter.ts]` · `[caps: BrowserPlatformService]`
- `src/services/speechVoices.ts` (L2, 267L, fan-in:9) — `[deps: IPlatformService.ts, apiClient.ts, auth.ts, index.ts, types.ts, platformService.ts]` · `[caps: GeminiVoiceOption, DeviceVoiceOption, SpeechSettings, GEMINI_VOICES, DEFAULT_SPEECH_SETTINGS, ISpeechVoicesService]`
- `src/services/integrationService.ts` (L2, 746L, fan-in:7) — `[deps: integrations.ts, apiClient.ts, IPlatformService.ts]` · `[caps: OAuthProviderAvailability, IntegrationVerifyResponse, IIntegrationApiService, IntegrationApiService]`
- `src/services/codeGenerators/ICodeGeneratorPlugin.ts` (L2, 11L, fan-in:6) — `[deps: types.ts]` · `[caps: CodeLangId, ICodeGeneratorPlugin]`
- `src/services/auth.ts` (L2, 59L, fan-in:5) — `[deps: apiClient.ts]` · `[caps: IAuthService, AuthServiceConfig, AuthService]`
- `src/services/codeGenerators/BaseCodeGenerator.ts` (L2, 27L, fan-in:5) — `[deps: types.ts, ICodeGeneratorPlugin.ts]` · `[caps: BaseCodeGenerator]`
- `src/services/codeGeneratorService.ts` (L2, 40L, fan-in:5) — `[deps: index.ts]` · `[caps: CodeLangId, CodeGenerator, ICodeGeneratorService, CodeGeneratorServiceConfig, CodeGeneratorService]`
- `src/services/codeGenerators/index.ts` (L2, 7L, fan-in:4) — `[deps: ICodeGeneratorPlugin.ts, BaseCodeGenerator.ts, PythonGenerator.ts, TypeScriptGenerator.ts, KotlinGenerator.ts, CurlGenerator.ts]` · `[caps: internal]`
- `src/services/geminiStreamService.ts` (L2, 629L, fan-in:4) — `[deps: IPlatformService.ts, types.ts, apiClient.ts, sseParser.ts, logger.ts, platformService.ts]` · `[caps: StreamCallbacks, StreamOptions, GeminiApiError, IGeminiStreamService, GeminiStreamServiceConfig, GeminiStreamService]`
- `src/services/sentenceSpeechQueue.ts` (L2, 294L, fan-in:4) — `[deps: IPlatformService.ts, platformService.ts, speechExtractor.ts, speechVoices.ts]` · `[caps: SentenceQueueOptions, ISentenceSpeechQueue, SentenceSpeechQueue]`
- `src/services/themeService.ts` (L2, 203L, fan-in:4) — `[deps: IPlatformService.ts, platformService.ts, index.ts, types.ts, observable.ts]` · `[caps: ThemeMode, ResolvedTheme, ThemeState, ThemeListener, IThemeService, ThemeServiceConfig]`
- `src/services/authProvider.ts` (L2, 18L, fan-in:3) — `[deps: types.ts]` · `[caps: AuthSignInResult, IAuthProvider]`
- `src/services/clipboardService.ts` (L2, 38L, fan-in:3) — `[deps: IPlatformService.ts, logger.ts]` · `[caps: IClipboardService, BrowserClipboardService]`
- `src/services/googleAuth.ts` (L2, 351L, fan-in:3) — `[deps: IPlatformService.ts, timeProvider.ts, types.ts, index.ts, types.ts, apiClient.ts]` · `[caps: GoogleAuthServiceConfig, IGoogleAuthService, GoogleAuthService]`
- `src/services/localModelService.ts` (L2, 833L, fan-in:3) — `[deps: types.ts, observable.ts, logger.ts, errorHandling.ts, providerCatalog.ts]` · `[caps: LocalStreamCallbacks, BrowserAIAvailability, ILocalModelService, LocalModelService]`
- `src/services/promptTemplateService.ts` (L2, 269L, fan-in:3) — `[deps: timeProvider.ts, types.ts, index.ts, types.ts, idGenerator.ts, firestoreSyncService.ts]` · `[caps: IPromptTemplateService, BUILTIN_PROMPT_TEMPLATES, PromptTemplateServiceConfig, PromptTemplateService]`
- `src/services/chatHistoryService.ts` (L2, 235L, fan-in:2) — `[deps: IPlatformService.ts, index.ts, types.ts, types.ts, logger.ts, platformService.ts]` · `[caps: IChatHistoryService, ChatHistoryServiceConfig, ChatHistoryService]`
- `src/services/fileDownloadService.ts` (L2, 39L, fan-in:2) — `[deps: IPlatformService.ts, logger.ts, platformService.ts]` · `[caps: IFileDownloadService, BrowserFileDownloadService]`
- `src/services/firebase.ts` (L2, 118L, fan-in:2) — `[deps: none]` · `[caps: OperationType, FirestoreErrorInfo, app, db, auth, getFirebaseAuthInstance]`
- `src/services/firestoreSyncService.ts` (L2, 589L, fan-in:2) — `[deps: types.ts, firebase.ts, logger.ts]` · `[caps: sanitizeFirestoreId, FirestoreSyncCallbacks, IFirestoreSyncService, FirestoreSyncService, firestoreSyncService]`
- `src/services/keyVerification.ts` (L2, 149L, fan-in:2) — `[deps: timeProvider.ts, errorHandling.ts, types.ts, apiClient.ts, logger.ts, clipboardService.ts]` · `[caps: STANDARD_GOOGLE_KEY_REGEX, AISTUDIO_PROJECT_KEY_REGEX, IKeyVerificationService, KeyVerificationServiceConfig, KeyVerificationService]`
- `src/services/stubsService.ts` (L2, 280L, fan-in:2) — `[deps: IPlatformService.ts, apiClient.ts, types.ts, logger.ts, platformService.ts]` · `[caps: StubsDiagramResponse, StubsLintResponse, StubsSpecsResponse, StubsExecuteResponse, IStubsClient, StubsClientConfig]`
- `src/services/appAuthManager.ts` (L2, 147L, fan-in:1) — `[deps: types.ts, googleAuth.ts, auth.ts, general.ts, providers.ts, logger.ts]` · `[caps: IAppAuthManager, AppAuthManagerConfig, AppAuthManager]`
- `src/services/codeGenerators/CurlGenerator.ts` (L2, 80L, fan-in:1) — `[deps: types.ts, BaseCodeGenerator.ts, ICodeGeneratorPlugin.ts]` · `[caps: CurlGenerator]`
- `src/services/codeGenerators/KotlinGenerator.ts` (L2, 45L, fan-in:1) — `[deps: types.ts, BaseCodeGenerator.ts, ICodeGeneratorPlugin.ts]` · `[caps: KotlinGenerator]`
- `src/services/codeGenerators/PythonGenerator.ts` (L2, 94L, fan-in:1) — `[deps: types.ts, BaseCodeGenerator.ts, ICodeGeneratorPlugin.ts]` · `[caps: PythonGenerator]`
- `src/services/codeGenerators/TypeScriptGenerator.ts` (L2, 141L, fan-in:1) — `[deps: types.ts, BaseCodeGenerator.ts, ICodeGeneratorPlugin.ts]` · `[caps: TypeScriptGenerator]`
- `src/services/firebaseAuthProvider.ts` (L2, 164L, fan-in:1) — `[deps: IPlatformService.ts, authProvider.ts, types.ts, firebase.ts, logger.ts, platformService.ts]` · `[caps: FirebaseAuthProvider]`
- `src/services/pwaInstallService.ts` (L2, 75L, fan-in:1) — `[deps: IPlatformService.ts, observable.ts, platformService.ts]` · `[caps: BeforeInstallPromptEvent, PWAInstallState, PwaInstallServiceConfig, IPwaInstallService, PwaInstallService]`
- `src/services/windowSecurityService.ts` (L2, 126L, fan-in:1) — `[deps: IPlatformService.ts, observable.ts, general.ts, platformService.ts]` · `[caps: ShieldState, WindowSecurityServiceConfig, IWindowSecurityService, WindowSecurityService]`
