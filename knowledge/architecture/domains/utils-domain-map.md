---
title: "Utils Domain Map"
type: domain-context-map
status: active
domain: utils
layer: 1
---

# Utils Domain Map

> Pure utility functions, platform detection, API client helpers, and AES-GCM encrypted local storage adapters.

## Domain Metrics & Canonical Hubs
- **Layer Tier**: Layer 1 (Utilities & Encrypted Storage)
- **Production Modules**: 81
- **Canonical Hubs**: `src/utils/logger.ts` (fan-in: 51, fan-out: 0), `src/utils/apiClient.ts` (fan-in: 23, fan-out: 5), `src/utils/observable.ts` (fan-in: 20, fan-out: 1), `src/utils/errorHandling.ts` (fan-in: 19, fan-out: 0)

## Module Inventory & Dependency Contracts
- `src/utils/logger.ts` (L1, 50L, fan-in:51) — `[deps: none]` · `[caps: ILogger, ConsoleLogger, NoOpLogger, ILoggerFactory, DefaultLoggerFactory, NoOpLoggerFactory]`
- `src/utils/apiClient.ts` (L1, 198L, fan-in:23) — `[deps: urlUtils.ts, apiClientErrors.ts, apiClientInterceptors.ts, apiClientRetry.ts, apiResponseParser.ts]` · `[caps: ApiClientConfig, IApiClient, ApiClient]`
- `src/utils/observable.ts` (L1, 75L, fan-in:20) — `[deps: logger.ts]` · `[caps: Listener, IReadableStore, IObservable, Observable]`
- `src/utils/errorHandling.ts` (L1, 49L, fan-in:19) — `[deps: none]` · `[caps: extractMessageFromUnknown, getErrorMessage]`
- `src/utils/storage/types.ts` (L1, 49L, fan-in:19) — `[deps: observable.ts]` · `[caps: StorageSaveOptions, IStorageBase, IDisposable, CollectionOperationResult, ICollectionEngine, IMutableCollection]`
- `src/utils/timeProvider.ts` (L1, 38L, fan-in:18) — `[deps: none]` · `[caps: ITimeProvider, DefaultTimeProvider]`
- `src/utils/offlineService.ts` (L1, 219L, fan-in:15) — `[deps: IPlatformService.ts, observable.ts, asyncStorage.ts, logger.ts, offlineQueueStore.ts, syncEngine.ts]` · `[caps: OfflineMutation, ConflictData, SyncHandler, OFFLINE_QUEUE_KEY, IOfflineService, OfflineServiceConfig]`
- `src/utils/storage/StorageFactory.ts` (L1, 41L, fan-in:13) — `[deps: types.ts, StorageCollection.ts, StorageSingleton.ts, StorageRegistry.ts, MapCollection.ts, core.ts]` · `[caps: IStorageFactory, DefaultStorageFactory]`
- `src/utils/providerCatalog.ts` (L1, 440L, fan-in:10) — `[deps: types.ts]` · `[caps: ProviderDefinition, CLOUD_PROVIDER_DEFINITIONS, LOCAL_PROVIDER_DEFINITIONS, ALL_PROVIDER_DEFINITIONS, getProviderDefinition, getProviderDisplayName]`
- `src/utils/storage/constants.ts` (L1, 17L, fan-in:10) — `[deps: none]` · `[caps: STORAGE_KEYS]`
- `src/utils/apiClientInterceptors.ts` (L1, 52L, fan-in:9) — `[deps: none]` · `[caps: RequestInterceptor, Interceptor, ResponseInterceptor, IInterceptorManager, InterceptorManager]`
- `src/utils/apiResponseParser.ts` (L1, 33L, fan-in:9) — `[deps: apiClientErrors.ts]` · `[caps: IResponseParser, DefaultResponseParser]`
- `src/utils/errorReporter.ts` (L1, 119L, fan-in:9) — `[deps: eventEmitter.ts]` · `[caps: ReliabilityEventCategory, ReliabilityEvent, errorReporter]`
- `src/utils/storage/index.ts` (L1, 27L, fan-in:9) — `[deps: constants.ts, encryption.ts, helpers.ts, general.ts, draftState.ts, projects.ts]` · `[caps: StorageCollection, StorageSingleton, MapCollection]`
- `src/utils/urlUtils.ts` (L1, 57L, fan-in:9) — `[deps: IPlatformService.ts, platformService.ts]` · `[caps: IUrlBuilder, DefaultUrlBuilder, buildUrlWithParams]`
- `src/utils/apiClientErrors.ts` (L1, 60L, fan-in:8) — `[deps: errorHandling.ts]` · `[caps: RETRYABLE_STATUS_CODES, BaseApiError, isAbortError, parseErrorResponse]`
- `src/utils/eventEmitter.ts` (L1, 40L, fan-in:8) — `[deps: logger.ts]` · `[caps: EventListener, IEventEmitter, EventEmitter]`
- `src/utils/idGenerator.ts` (L1, 24L, fan-in:8) — `[deps: timeProvider.ts, randomProvider.ts]` · `[caps: IIdGenerator, DefaultIdGenerator]`
- `src/utils/storage/general.ts` (L1, 85L, fan-in:8) — `[deps: StorageFactory.ts, constants.ts, core.ts, types.ts, observable.ts]` · `[caps: IGeneralSettingsService, GeneralSettingsServiceConfig, GeneralSettingsService]`
- `src/utils/storage/helpers.ts` (L1, 174L, fan-in:7) — `[deps: mockDefinitions.ts]` · `[caps: EntityMapper, cleanMockData, fastDeepEqual, getNestedValue, deepFreeze]`
- `src/utils/asyncStorage.ts` (L1, 86L, fan-in:6) — `[deps: logger.ts]` · `[caps: AsyncStorage, IndexedDbAsyncStorage, MemoryAsyncStorage, FallbackAsyncStorage]`
- `src/utils/integrationCatalog.ts` (L1, 85L, fan-in:6) — `[deps: integrations.ts]` · `[caps: IntegrationProviderDefinition, INTEGRATION_PROVIDER_DEFINITIONS, getIntegrationDefinition]`
- `src/utils/networkStatus.ts` (L1, 182L, fan-in:6) — `[deps: IPlatformService.ts, observable.ts, platformService.ts]` · `[caps: NetworkStatus, INetworkStatusProvider, BrowserNetworkStatusConfig, BrowserNetworkStatusProvider]`
- `src/utils/storage/ActiveItemManager.ts` (L1, 106L, fan-in:6) — `[deps: observable.ts, computedStore.ts, types.ts, selectionStrategy.ts]` · `[caps: ActiveItemManagerOptions, ActiveItemManagerState, IActiveItemManager, ActiveItemManager]`
- `src/utils/storage/core.ts` (L1, 167L, fan-in:6) — `[deps: IPlatformService.ts, types.ts, FallbackStorageWrapper.ts, logger.ts, index.ts, platformService.ts]` · `[caps: MemoryStorage, createDefaultStorageInstance, safeParseStorageItem, safeGetStorage, safeGetStorageKeys, safeSetStorage]`
- `src/utils/storage/draftState.ts` (L1, 184L, fan-in:6) — `[deps: types.ts, templates.ts, StorageFactory.ts, StorageRegistry.ts, types.ts, constants.ts]` · `[caps: DraftState, IDraftStateService, DraftStateServiceConfig, DraftStateService]`
- `src/utils/storage/syncAdapter.ts` (L1, 162L, fan-in:6) — `[deps: offlineService.ts, apiClient.ts, networkStatus.ts, offlineRetryStrategy.ts, logger.ts, syncAdapterErrors.ts]` · `[caps: IStorageSyncAdapter, ISyncTransport, ApiClientSyncTransport, NetworkStorageSyncAdapterConfig, NetworkStorageSyncAdapter]`
- `src/utils/crossTabNotifier/CrossTabNotifierFactory.ts` (L1, 21L, fan-in:5) — `[deps: types.ts, BroadcastChannelNotifier.ts, StorageEventNotifier.ts, FallbackCrossTabNotifier.ts, logger.ts]` · `[caps: DefaultCrossTabNotifierFactory]`
- `src/utils/crossTabNotifier/types.ts` (L1, 25L, fan-in:5) — `[deps: IPlatformService.ts, logger.ts, timeProvider.ts, types.ts]` · `[caps: ICrossTabNotifier, CrossTabNotifierConfig, ICrossTabNotifierFactory]`
- `src/utils/modelCatalog.ts` (L1, 178L, fan-in:5) — `[deps: types.ts, apiClient.ts]` · `[caps: fetchModels, FALLBACK_MODEL_ID, CURATED_MODELS, isDeprecatedOrUnusableModel, sanitizeModelId]`
- `src/utils/offlineQueueStore.ts` (L1, 172L, fan-in:5) — `[deps: IPlatformService.ts, mutex.ts, observable.ts, logger.ts, offlineService.ts, index.ts]` · `[caps: IOfflineQueueStore, OfflineQueueStoreConfig, OfflineQueueStore]`
- `src/utils/storage/encryption.ts` (L1, 159L, fan-in:5) — `[deps: none]` · `[caps: encryptSecret, decryptSecret]`
- `src/utils/storage/offlineRetryStrategy.ts` (L1, 22L, fan-in:5) — `[deps: apiClientErrors.ts]` · `[caps: IOfflineRetryStrategy, DefaultOfflineRetryStrategy]`
- `src/utils/storage/providers.ts` (L1, 177L, fan-in:5) — `[deps: types.ts, idGenerator.ts, constants.ts, encryption.ts, StorageFactory.ts, types.ts]` · `[caps: IProviderConnectionService, ProviderConnectionServiceConfig, ProviderConnectionService]`
- `src/utils/storage/selectionStrategy.ts` (L1, 19L, fan-in:5) — `[deps: none]` · `[caps: ISelectionStrategy, FirstItemSelectionStrategy, NoImplicitSelectionStrategy]`
- `src/utils/storage/StorageRegistry.ts` (L1, 56L, fan-in:5) — `[deps: none]` · `[caps: IStorageRegistry, StorageRegistry]`
- `src/utils/batchSelectionManager.ts` (L1, 130L, fan-in:4) — `[deps: observable.ts, helpers.ts]` · `[caps: SelectionState, BatchSelectionState, IBatchSelectionManager, BatchSelectionManager]`
- `src/utils/delayStrategy.ts` (L1, 50L, fan-in:4) — `[deps: randomProvider.ts]` · `[caps: IDelayStrategy, FixedIntervalDelayStrategy, ExponentialBackoffDelayStrategy]`
- `src/utils/speechExtractor.ts` (L1, 74L, fan-in:4) — `[deps: none]` · `[caps: extractSpokenText]`
- `src/utils/storage/projects.ts` (L1, 132L, fan-in:4) — `[deps: types.ts, idGenerator.ts, constants.ts, core.ts, encryption.ts, ActiveItemManagerFactory.ts]` · `[caps: IProjectService, ProjectServiceConfig, ProjectService]`
- `src/utils/storage/serializer/index.ts` (L1, 3L, fan-in:4) — `[deps: types.ts, JsonSerializer.ts]` · `[caps: internal]`
- `src/utils/storage/serializer/types.ts` (L1, 5L, fan-in:4) — `[deps: none]` · `[caps: ISerializer]`
- `src/data/templates.ts` (L1, 83L, fan-in:3) — `[deps: timeProvider.ts, types.ts]` · `[caps: DEFAULT_CONFIG, getStarterTemplates]`
- `src/utils/apiClientRetry.ts` (L1, 135L, fan-in:3) — `[deps: IPlatformService.ts, apiClientErrors.ts, delayStrategy.ts, platformService.ts]` · `[caps: RetryConfig, IRetryStrategy, ExponentialBackoffRetryStrategy]`
- `src/utils/crossTabNotifier/BroadcastChannelNotifier.ts` (L1, 52L, fan-in:3) — `[deps: IPlatformService.ts, types.ts, logger.ts]` · `[caps: BroadcastChannelNotifier]`
- `src/utils/crossTabNotifier/FallbackCrossTabNotifier.ts` (L1, 60L, fan-in:3) — `[deps: types.ts, logger.ts]` · `[caps: FallbackCrossTabNotifier]`
- `src/utils/crossTabNotifier/StorageEventNotifier.ts` (L1, 76L, fan-in:3) — `[deps: IPlatformService.ts, timeProvider.ts, types.ts, logger.ts, JsonSerializer.ts, types.ts]` · `[caps: StorageEventNotifier]`
- `src/utils/fileTree.ts` (L1, 146L, fan-in:3) — `[deps: stubs.ts]` · `[caps: collectAncestorPaths, collectDirectoryPaths, filterFileTree, countTreeNodes, FileVisualCategory, getFileCategory]`
- `src/utils/randomProvider.ts` (L1, 11L, fan-in:3) — `[deps: none]` · `[caps: IRandomProvider, DefaultRandomProvider]`
- `src/utils/sseParser.ts` (L1, 90L, fan-in:3) — `[deps: none]` · `[caps: SSEEventCallback, ISSEStreamParser, ISSEStreamParserFactory, SSEStreamParser]`
- `src/utils/storage/ActiveItemManagerFactory.ts` (L1, 55L, fan-in:3) — `[deps: ActiveItemManager.ts, StorageCollection.ts, StorageFactory.ts, StorageSingleton.ts, types.ts, selectionStrategy.ts]` · `[caps: CreateActiveItemManagerOptions, IActiveItemManagerFactory, DefaultActiveItemManagerFactory]`
- `src/utils/storage/integrations.ts` (L1, 152L, fan-in:3) — `[deps: integrations.ts, idGenerator.ts, constants.ts, encryption.ts, StorageFactory.ts, types.ts]` · `[caps: IIntegrationConnectionService, IntegrationConnectionServiceConfig, IntegrationConnectionService]`
- `src/utils/storage/MapCollection.ts` (L1, 147L, fan-in:3) — `[deps: types.ts, helpers.ts]` · `[caps: MapCollection]`
- `src/utils/storage/serializer/JsonSerializer.ts` (L1, 12L, fan-in:3) — `[deps: types.ts]` · `[caps: JsonSerializer]`
- `src/utils/storage/StorageBase.ts` (L1, 141L, fan-in:3) — `[deps: types.ts, observable.ts, logger.ts, helpers.ts, eventEmitter.ts, index.ts]` · `[caps: StorageBaseOptions, StorageBase]`
- `src/utils/storage/StorageCollection.ts` (L1, 121L, fan-in:3) — `[deps: StorageBase.ts, types.ts, eventEmitter.ts, logger.ts, index.ts]` · `[caps: StorageCollectionOptions, StorageCollection]`
- `src/utils/storage/StorageSingleton.ts` (L1, 18L, fan-in:3) — `[deps: StorageBase.ts, types.ts, index.ts]` · `[caps: StorageSingletonOptions, StorageSingleton]`
- `src/utils/syncConflictBus.ts` (L1, 17L, fan-in:3) — `[deps: eventEmitter.ts, offlineService.ts]` · `[caps: syncConflictBus]`
- `src/utils/syncEngine.ts` (L1, 67L, fan-in:3) — `[deps: offlineQueueStore.ts, logger.ts, offlineService.ts, syncEngineStrategy.ts]` · `[caps: ISyncEngine, SyncEngine]`
- `src/utils/syncVersionTracker.ts` (L1, 69L, fan-in:3) — `[deps: none]` · `[caps: SyncResourceKind, syncVersionTracker]`
- `src/utils/computedStore.ts` (L1, 120L, fan-in:2) — `[deps: observable.ts]` · `[caps: ComputedStore]`
- `src/utils/crossTabNotifier/index.ts` (L1, 6L, fan-in:2) — `[deps: types.ts, BroadcastChannelNotifier.ts, StorageEventNotifier.ts, FallbackCrossTabNotifier.ts, CrossTabNotifierFactory.ts]` · `[caps: internal]`
- `src/utils/imageCompressor.ts` (L1, 154L, fan-in:2) — `[deps: IPlatformService.ts, types.ts, idGenerator.ts, platformService.ts]` · `[caps: CompressionOptions, calculateProportionalDimensions, IImageCompressionStrategy, CanvasImageCompressionStrategyConfig, CanvasImageCompressionStrategy, IImageCompressor]`
- `src/utils/mockDefinitions.ts` (L1, 73L, fan-in:2) — `[deps: none]` · `[caps: COMMON_MOCK_PREFIXES, MOCK_SESSION_EXACT_IDS, MOCK_SESSION_TITLES, MOCK_MESSAGE_IDS, MOCK_MESSAGE_TEXTS, isMockSession]`
- `src/utils/mutex.ts` (L1, 63L, fan-in:2) — `[deps: IPlatformService.ts, logger.ts]` · `[caps: IMutex, Mutex]`
- `src/utils/platform.ts` (L1, 263L, fan-in:2) — `[deps: none]` · `[caps: AppRuntime, isBrowserEnvironment, WindowWithMatchMedia, WindowWithSpeech, WindowWithCapacitor, NavigatorWithStandalone]`
- `src/utils/pwaUpdate.ts` (L1, 84L, fan-in:2) — `[deps: none]` · `[caps: PwaUpdateState, pwaUpdateManager]`
- `src/utils/storage/degradationState.ts` (L1, 67L, fan-in:2) — `[deps: errorReporter.ts]` · `[caps: StorageDegradationState, storageDegradationTracker]`
- `src/utils/storage/FallbackStorageWrapper.ts` (L1, 203L, fan-in:2) — `[deps: IPlatformService.ts, platformService.ts, eventEmitter.ts, logger.ts]` · `[caps: MemoryStorage, FallbackStorageWrapper]`
- `src/utils/storage/prompts.ts` (L1, 63L, fan-in:2) — `[deps: types.ts, ActiveItemManagerFactory.ts, constants.ts, ActiveItemManager.ts, syncAdapter.ts, StorageFactory.ts]` · `[caps: ISavedPromptsService, SavedPromptsServiceConfig, SavedPromptsService]`
- `src/utils/storage/syncAdapterFormData.ts` (L1, 29L, fan-in:2) — `[deps: apiClient.ts, syncAdapter.ts]` · `[caps: FormDataSyncTransport]`
- `src/utils/streamCoalescer.ts` (L1, 97L, fan-in:2) — `[deps: none]` · `[caps: StreamCoalescerOptions, StreamCoalescer, createStreamCoalescer]`
- `src/utils/syncEngineStrategy.ts` (L1, 151L, fan-in:2) — `[deps: logger.ts, offlineService.ts]` · `[caps: QueueProcessResult, IQueueProcessingStrategy, StrictFifoStrategyOptions, StrictFifoQueueProcessingStrategy]`
- `src/utils/syncOrchestrator.ts` (L1, 89L, fan-in:2) — `[deps: offlineService.ts, apiClient.ts]` · `[caps: SyncHandlerConfig, ISyncOrchestrator, SyncOrchestrator]`
- `src/utils/syntaxHighlight.ts` (L1, 142L, fan-in:2) — `[deps: none]` · `[caps: clearHighlightCache, countLines, escapeHtml, normalizeEditorLanguage, highlightCodeToHtml]`
- `src/utils/polling.ts` (L1, 83L, fan-in:1) — `[deps: IPlatformService.ts, delayStrategy.ts, platformService.ts]` · `[caps: IPollingStrategy, FixedIntervalPollingStrategy, ExponentialBackoffPollingStrategy, PollingOptions, startPolling]`
- `src/utils/storage/syncAdapterErrors.ts` (L1, 10L, fan-in:1) — `[deps: apiClientErrors.ts]` · `[caps: SyncAdapterError]`
- `src/utils/syncRegistry.ts` (L1, 56L, fan-in:1) — `[deps: syncOrchestrator.ts, offlineService.ts, apiClient.ts, syncVersionTracker.ts]` · `[caps: DEFAULT_SYNC_HANDLERS, initializeSyncHandlers]`
- `src/utils/testUtils/storageEvent.ts` (L1, 11L, fan-in:1) — `[deps: none]` · `[caps: StorageEventCtor]`
- `src/utils/codeGenerators.ts` (L1, 2L, fan-in:0) — `[deps: codeGeneratorService.ts]` · `[caps: internal]`
- `src/utils/index.ts` (L1, 6L, fan-in:0) — `[deps: offlineService.ts, networkStatus.ts, logger.ts, syncEngineStrategy.ts, syncEngine.ts]` · `[caps: internal]`
