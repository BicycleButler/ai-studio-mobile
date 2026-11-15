---
title: Utils Domain — Domain Context Map
type: domain-context-map
domain: utils
parent_map: ../context-map.md
description: Deep-dive context map for the utils domain, subsystem responsibilities, and internal modules.
tags:
  - domain-map
  - utils
  - agent-optimized
---

# Utils Domain — Domain Context Map

Parent Context Map: knowledge/architecture/context-map.md

## Domain Purpose & Responsibilities
The Utils Domain coordinates domain logic, core types, and services for the utils subsystem.

## Key Modules & Files
src/utils/platform.ts (Hub) -> deps: none | caps: AppRuntime, isBrowserEnvironment, WindowWithMatchMedia, WindowWithSpeech, WindowWithCapacitor, NavigatorWithStandalone, WindowWithLocalStorage, WindowWithSpeechSynthesis
src/utils/storage/core.ts -> deps: none | caps: createDefaultStorageInstance, MemoryStorage, getItem, setItem, removeItem, clear, key, safeParseStorageItem
src/utils/offlineQueueStore.ts -> deps: none | caps: IOfflineQueueStore, OfflineQueueStoreConfig, OfflineQueueStore, getObservable, notifyQueue, syncCacheFromStorage, getSnapshot, safeGetQueue
src/utils/offlineService.ts -> deps: none | caps: OfflineMutation, ConflictData, SyncHandler, IOfflineService, OfflineServiceConfig, OfflineService, getObservable, registerSyncHandler
src/utils/logger.ts -> deps: none | caps: ILogger, ConsoleLogger, debug, info, warn, error, NoOpLogger, ILoggerFactory
src/utils/storage/jules.ts -> deps: none | caps: IJulesStorageService, JulesStorageServiceConfig, JulesStorageService, loadStoredJulesApiKey, saveStoredJulesApiKey, isMockJulesSession, fetchJulesSessionsFromServer, loadStoredJulesSettings
src/utils/apiClient.ts -> deps: none | caps: ApiClientConfig, IApiClient, ApiClient, addInterceptor, clearInterceptors, addResponseInterceptor, prepareRequest, fetchWithRetry
src/utils/imageCompressor.ts -> deps: none | caps: CompressionOptions, calculateProportionalDimensions, IImageCompressionStrategy, CanvasImageCompressionStrategyConfig, CanvasImageCompressionStrategy, isWebPSupported, compress, IImageCompressor
src/utils/apiClientInterceptors.ts -> deps: none | caps: RequestInterceptor, Interceptor, ResponseInterceptor, IInterceptorManager, InterceptorManager, addInterceptor, clearInterceptors, applyInterceptors
src/utils/asyncStorage.ts -> deps: none | caps: AsyncStorage, IndexedDbAsyncStorage, getItem, setItem, MemoryAsyncStorage, FallbackAsyncStorage
src/utils/storage/ActiveItemManager.ts -> deps: none | caps: ActiveItemManagerOptions, ActiveItemManagerState, IActiveItemManager, ActiveItemManager, getSnapshot, getItems, getActiveId, setActiveId
src/utils/batchSelectionManager.ts -> deps: none | caps: SelectionState, BatchSelectionState, IBatchSelectionManager, BatchSelectionManager, clearSelection, toggleSelection, toggleSelectAll, removeFromSelection
src/utils/computedStore.ts -> deps: none | caps: ComputedStore, startObservingDependencies, stopObservingDependencies, subscribe, updateLastKnownDependencies, checkDependenciesChanged, markDirty, getSnapshot
src/utils/observable.ts -> deps: none | caps: Listener, IReadableStore, IObservable, Observable, subscribe, notify, notifySync, getSnapshot
src/utils/storage/MapCollection.ts -> deps: none | caps: MapCollection, update, processUpdates, processUpserts, bulkUpdate, delete, bulkDelete, upsert
src/utils/storage/StorageBase.ts -> deps: none | caps: StorageBaseOptions, StorageBase, processRawValue, handleStorageEvent, getSnapshot, load, save, clear
src/utils/storage/StorageCollection.ts -> deps: none | caps: StorageCollectionOptions, StorageCollection, applyOperation, update, bulkUpdate, bulkDelete, delete, upsert
src/utils/sseParser.ts -> deps: none | caps: SSEEventCallback, ISSEStreamParser, ISSEStreamParserFactory, SSEStreamParser, processChunk, flush, dispatchCurrentEvent, processLines
src/utils/storage/projects.ts -> deps: none | caps: IProjectService, ProjectServiceConfig, ProjectService, loadStoredProjects, saveStoredProjects, getActiveProjectId, setActiveProjectId, saveAndActivateProject
src/utils/storage/draftState.ts -> deps: none | caps: DraftState, IDraftStateService, DraftStateServiceConfig, DraftStateService, getProjectDraftKey, getDraftSingleton, loadDraftState, saveDraftState
src/utils/delayStrategy.ts -> deps: none | caps: IDelayStrategy, FixedIntervalDelayStrategy, getNextDelayMs, withBaseDelay, ExponentialBackoffDelayStrategy
src/utils/storage/FallbackStorageWrapper.ts -> deps: none | caps: FallbackStorageWrapper, promoteToMemory, getItem, setItem, removeItem, clear, key
src/utils/storage/general.ts -> deps: none | caps: IGeneralSettingsService, GeneralSettingsServiceConfig, GeneralSettingsService, loadStoredApiKey, saveStoredApiKey, isFlagSecureEnabled, setFlagSecureEnabled
src/utils/storage/syncAdapter.ts -> deps: none | caps: IStorageSyncAdapter, ISyncTransport, ApiClientSyncTransport, transmit, NetworkStorageSyncAdapterConfig, NetworkStorageSyncAdapter, syncItem
src/utils/storage/types.ts -> deps: none | caps: IStorageBase, IDisposable, CollectionOperationResult, ICollectionEngine, IMutableCollection, IMutableSingleton, IStorageAdapter
src/utils/eventEmitter.ts -> deps: none | caps: EventListener, IEventEmitter, EventEmitter, subscribe, emit, clearListeners
src/utils/networkStatus.ts -> deps: none | caps: NetworkStatus, INetworkStatusProvider, BrowserNetworkStatusProvider, getObservable, initListeners, isOnline
src/utils/storage/StorageFactory.ts -> deps: none | caps: IStorageFactory, DefaultStorageFactory, getStorageInstance, createCollection, createSingleton, createRegistry
src/utils/storage/StorageRegistry.ts -> deps: none | caps: IStorageRegistry, StorageRegistry, get, delete, clear, disposeStore
src/utils/apiClientErrors.ts -> deps: none | caps: BaseApiError, fromResponse, isRetryable, isAbortError, parseErrorResponse
src/utils/crossTabNotifier/BroadcastChannelNotifier.ts -> deps: none | caps: BroadcastChannelNotifier, notify, onMessage, dispose, isSupported
src/utils/crossTabNotifier/FallbackCrossTabNotifier.ts -> deps: none | caps: FallbackCrossTabNotifier, isSupported, notify, onMessage, dispose
src/utils/crossTabNotifier/StorageEventNotifier.ts -> deps: none | caps: StorageEventNotifier, handleStorageEvent, notify, onMessage, dispose
src/utils/polling.ts -> deps: none | caps: IPollingStrategy, FixedIntervalPollingStrategy, ExponentialBackoffPollingStrategy, PollingOptions, startPolling
src/utils/storage/prompts.ts -> deps: none | caps: ISavedPromptsService, SavedPromptsServiceConfig, SavedPromptsService, loadSavedPrompts, persistSavedPrompts
src/utils/storage/selectionStrategy.ts -> deps: none | caps: ISelectionStrategy, FirstItemSelectionStrategy, selectImplicitItem, NoImplicitSelectionStrategy
src/utils/syncOrchestrator.ts -> deps: none | caps: SyncHandlerConfig, ISyncOrchestrator, SyncOrchestrator, createGenericSyncHandler, registerHandlers
src/utils/timeProvider.ts -> deps: none | caps: ITimeProvider, DefaultTimeProvider, now, date, formatRelative
src/utils/storage/helpers.ts -> deps: none | caps: EntityMapper, cleanMockData, fastDeepEqual, getNestedValue, deepFreeze
src/utils/apiClientRetry.ts -> deps: none | caps: RetryConfig, IRetryStrategy, ExponentialBackoffRetryStrategy, execute
src/utils/apiResponseParser.ts -> deps: none | caps: IResponseParser, DefaultResponseParser, parseStream, parse
src/utils/mutex.ts -> deps: none | caps: IMutex, Mutex, acquire, run
src/utils/storage/ActiveItemManagerFactory.ts -> deps: none | caps: CreateActiveItemManagerOptions, IActiveItemManagerFactory, DefaultActiveItemManagerFactory, create
src/utils/syncEngine.ts -> deps: none | caps: ISyncEngine, SyncEngine, registerSyncHandler, processOfflineMutations
src/utils/urlUtils.ts -> deps: none | caps: IUrlBuilder, DefaultUrlBuilder, build, buildUrlWithParams
src/utils/crossTabNotifier/types.ts -> deps: none | caps: ICrossTabNotifier, CrossTabNotifierConfig, ICrossTabNotifierFactory
src/utils/errorHandling.ts -> deps: none | caps: extractMessageFromUnknown, tryParseJsonMessage, getErrorMessage
src/utils/idGenerator.ts -> deps: none | caps: IIdGenerator, DefaultIdGenerator, generate
src/utils/modelCatalog.ts -> deps: none | caps: fetchModels, isDeprecatedOrUnusableModel, sanitizeModelId
src/utils/randomProvider.ts -> deps: none | caps: IRandomProvider, DefaultRandomProvider, random
src/utils/storage/offlineRetryStrategy.ts -> deps: none | caps: IOfflineRetryStrategy, DefaultOfflineRetryStrategy, shouldEnqueue
src/utils/storage/serializer/JsonSerializer.ts -> deps: none | caps: JsonSerializer, serialize, deserialize
src/utils/syncEngineStrategy.ts -> deps: none | caps: IQueueProcessingStrategy, StrictFifoQueueProcessingStrategy, process
src/utils/crossTabNotifier/CrossTabNotifierFactory.ts -> deps: none | caps: DefaultCrossTabNotifierFactory, createCrossTabNotifier
src/utils/storage/StorageSingleton.ts -> deps: none | caps: StorageSingletonOptions, StorageSingleton
src/utils/storage/encryption.ts -> deps: none | caps: encryptSecret, decryptSecret
src/utils/storage/syncAdapterFormData.ts -> deps: none | caps: FormDataSyncTransport, transmit
src/utils/speechExtractor.ts -> deps: none | caps: extractSpokenText
src/utils/storage/serializer/types.ts -> deps: none | caps: ISerializer
src/utils/storage/syncAdapterErrors.ts -> deps: none | caps: SyncAdapterError
src/utils/testUtils/storageEvent.ts -> deps: none | caps: StorageEventCtor
src/utils/mockDefinitions.ts -> deps: none | caps: isMockSession
src/utils/syncRegistry.ts -> deps: none | caps: initializeSyncHandlers
src/utils/codeGenerators.ts -> deps: none | caps: internal
src/utils/crossTabNotifier/index.ts -> deps: none | caps: internal
src/utils/index.ts -> deps: none | caps: internal
src/utils/storage/serializer/index.ts -> deps: none | caps: internal
src/utils/storage/constants.ts -> deps: none | caps: internal
src/utils/storage/index.ts -> deps: none | caps: internal

## Domain Invariants
- Downward dependencies only: cross-domain calls must target canonical domain hubs.
- External consumers must interface through platform.ts, never private internal helpers.
- State changes must adhere to lifecycle and containment invariants.
