import { DefaultUrlBuilder } from "../utils/urlUtils";
import { DefaultResponseParser } from "../utils/apiResponseParser";
import { InterceptorManager } from "../utils/apiClientInterceptors";
import { IAppAuthManager, AppAuthManager } from "./appAuthManager";
import { IPlatformService, BrowserPlatformService } from "./platformService";
import React, { createContext, useContext, ReactNode } from "react";

import { IApiClient, ApiClient } from "../utils/apiClient";
import { SyncOrchestrator, ISyncOrchestrator } from "../utils/syncOrchestrator";
import { DEFAULT_SYNC_HANDLERS } from "../utils/syncRegistry";
import { NetworkStorageSyncAdapter, ApiClientSyncTransport } from "../utils/storage/syncAdapter";
import { createDefaultStorageInstance, DefaultStorageFactory } from "../utils/storage";
import { DefaultCrossTabNotifierFactory } from "../utils/crossTabNotifier/CrossTabNotifierFactory";
import { ILogger, DefaultLoggerFactory } from "../utils/logger";
import { IIdGenerator, DefaultIdGenerator } from "../utils/idGenerator";

import { ITimeProvider, DefaultTimeProvider } from "../utils/timeProvider";
import { IThemeService, ThemeService } from "./themeService";
import { IPromptTemplateService, PromptTemplateService, BUILTIN_PROMPT_TEMPLATES } from "./promptTemplateService";
import { IAuthService, AuthService } from "./auth";
import { IGoogleAuthService, GoogleAuthService } from "./googleAuth";
import { IOfflineService } from "../utils/offlineService";
import { OfflineService } from "../utils/offlineService";
import { INetworkStatusProvider, BrowserNetworkStatusProvider } from "../utils/networkStatus";
import { DefaultOfflineRetryStrategy } from "../utils/storage/offlineRetryStrategy";
import { IChatHistoryService, ChatHistoryService } from "./chatHistoryService";
import { ProjectService, IProjectService } from "../utils/storage/projects";
import { SavedPromptsService, ISavedPromptsService } from "../utils/storage/prompts";
import { GeneralSettingsService, IGeneralSettingsService } from "../utils/storage/general";
import { DraftStateService, IDraftStateService } from "../utils/storage/draftState";
import { JulesStorageService, IJulesStorageService } from "../utils/storage/jules";
import { IJulesClient, JulesClient } from "./julesService";
import { IJulesSessionOrchestrator, JulesSessionOrchestrator } from "./julesSessionOrchestrator";
import { SpeechVoicesService, ISpeechVoicesService } from "./speechVoices";
import { ISentenceSpeechQueue, SentenceSpeechQueue, SentenceQueueOptions } from "./sentenceSpeechQueue";
import { GeminiStreamService, IGeminiStreamService } from "./geminiStreamService";
import { KeyVerificationService, IKeyVerificationService } from "./keyVerification";
import { StubsClient, IStubsClient } from "./stubsService";
import { CodeGeneratorService, ICodeGeneratorService } from "./codeGeneratorService";
import { PythonGenerator, TypeScriptGenerator, KotlinGenerator, CurlGenerator } from "./codeGenerators";
import { IPwaInstallService, PwaInstallService } from "./pwaInstallService";
import { IWindowSecurityService, WindowSecurityService } from "./windowSecurityService";
import { IImageCompressor, ImageCompressor, CanvasImageCompressionStrategy } from "../utils/imageCompressor";
import { IClipboardService, BrowserClipboardService } from "./clipboardService";
import { IFileDownloadService, BrowserFileDownloadService } from "./fileDownloadService";
import { SSEStreamParser } from "../utils/sseParser";
import { OfflineQueueStore } from "../utils/offlineQueueStore";
import { IndexedDbAsyncStorage, MemoryAsyncStorage, FallbackAsyncStorage } from "../utils/asyncStorage";
import { Mutex } from "../utils/mutex";
import { ExponentialBackoffRetryStrategy } from "../utils/apiClientRetry";
import { BatchSelectionManager, IBatchSelectionManager } from "../utils/batchSelectionManager";

export interface IServices {
  themeService: IThemeService;
  promptTemplateService: IPromptTemplateService;
  authService: IAuthService;
  googleAuthService: IGoogleAuthService;
  appAuthManager: IAppAuthManager;
  offlineService: IOfflineService;
  networkStatusProvider: INetworkStatusProvider;
  chatHistoryService: IChatHistoryService;
  projectService: IProjectService;
  savedPromptsService: ISavedPromptsService;
  generalSettingsService: IGeneralSettingsService;
  draftStateService: IDraftStateService;
  julesStorageService: IJulesStorageService;
  julesClient: IJulesClient;
  julesSessionOrchestrator: IJulesSessionOrchestrator;
  speechVoicesService: ISpeechVoicesService;
  createSentenceSpeechQueue: (options: SentenceQueueOptions) => ISentenceSpeechQueue;
  createSSEStreamParser: (onEvent: import("../utils/sseParser").SSEEventCallback) => import("../utils/sseParser").ISSEStreamParser;
  createBatchSelectionManager: () => IBatchSelectionManager;
  geminiStreamService: IGeminiStreamService;
  keyVerificationService: IKeyVerificationService;
  stubsClient: IStubsClient;
  codeGeneratorService: ICodeGeneratorService;
  apiClient: IApiClient;
  pwaInstallService: IPwaInstallService;
  windowSecurityService: IWindowSecurityService;
  syncOrchestrator: ISyncOrchestrator;
  logger: ILogger;
  imageCompressor: IImageCompressor;
  clipboardService: IClipboardService;
  fileDownloadService: IFileDownloadService;
  platformService: IPlatformService;
  timeProvider: ITimeProvider;
  idGenerator: IIdGenerator;
}




const explicitlyInjectedLogger = new DefaultLoggerFactory().createLogger();
const explicitlyInjectedIdGenerator = new DefaultIdGenerator();
const explicitlyInjectedTimeProvider = new DefaultTimeProvider();
const explicitlyInjectedPlatformService = new BrowserPlatformService();
const explicitlyInjectedStorageInstance = createDefaultStorageInstance();
const explicitlyInjectedStorageFactory = new DefaultStorageFactory(explicitlyInjectedStorageInstance);

const explicitlyInjectedApiClient = new ApiClient({
  interceptorManager: new InterceptorManager(),
  responseParser: new DefaultResponseParser(),
  urlBuilder: new DefaultUrlBuilder(),
  retryConfig: {
    retryStrategy: new ExponentialBackoffRetryStrategy(undefined, explicitlyInjectedPlatformService),
  }
});

const explicitlyInjectedOfflineService = new OfflineService({
  queueStore: new OfflineQueueStore({
    storageKey: 'ai_studio_offline_mutations',
    storageAdapter: new FallbackAsyncStorage([new IndexedDbAsyncStorage(), new MemoryAsyncStorage()], explicitlyInjectedLogger),
    logger: explicitlyInjectedLogger,
    platformService: explicitlyInjectedPlatformService,
    crossTabNotifierFactory: new DefaultCrossTabNotifierFactory(),
    mutex: new Mutex(explicitlyInjectedLogger, explicitlyInjectedPlatformService),
  }),
  idGenerator: explicitlyInjectedIdGenerator
});

const explicitlyInjectedSyncOrchestrator = new SyncOrchestrator(
  explicitlyInjectedOfflineService,
  explicitlyInjectedApiClient,
  DEFAULT_SYNC_HANDLERS
);

const explicitlyInjectedAuthService = new AuthService({
  apiClient: explicitlyInjectedApiClient,
  loadStoredApiKeyFn: () => ""
});

const explicitlyInjectedGoogleAuthService = new GoogleAuthService({
  apiClient: explicitlyInjectedApiClient,
  logger: explicitlyInjectedLogger,
  storageFactory: explicitlyInjectedStorageFactory
});

const explicitlyInjectedSpeechVoicesService = new SpeechVoicesService({
  apiClient: explicitlyInjectedApiClient,
  authService: explicitlyInjectedAuthService,
  storageFactory: explicitlyInjectedStorageFactory
});

const explicitlyInjectedKeyVerificationService = new KeyVerificationService({
  apiClient: explicitlyInjectedApiClient,
  logger: explicitlyInjectedLogger
});


const explicitlyInjectedJulesStorageService = new JulesStorageService({
  logger: explicitlyInjectedLogger,
  apiClient: explicitlyInjectedApiClient,
  julesSessionsManager: undefined,
  storageFactory: explicitlyInjectedStorageFactory,
  idGenerator: explicitlyInjectedIdGenerator,
  syncAdapter: new NetworkStorageSyncAdapter({
    transport: new ApiClientSyncTransport(explicitlyInjectedApiClient),
    offlineService: explicitlyInjectedOfflineService,
    networkStatusProvider: new BrowserNetworkStatusProvider(explicitlyInjectedPlatformService),
    retryStrategy: new DefaultOfflineRetryStrategy(),
    logger: explicitlyInjectedLogger,
    endpoint: "/api/jules/sessions"
  }),
});

const explicitlyInjectedJulesClient = new JulesClient({
  getApiKey: () => explicitlyInjectedJulesStorageService.loadStoredJulesApiKey(),
  getSettings: () => explicitlyInjectedJulesStorageService.loadStoredJulesSettings(),
  apiClient: explicitlyInjectedApiClient,
});

const explicitlyInjectedJulesSessionOrchestrator = new JulesSessionOrchestrator({
  julesClient: explicitlyInjectedJulesClient,
  julesStorageService: explicitlyInjectedJulesStorageService,
  timeProvider: explicitlyInjectedTimeProvider,
  idGenerator: explicitlyInjectedIdGenerator,
  logger: explicitlyInjectedLogger,
});

const explicitlyInjectedStubsClient = new StubsClient({ apiClient: explicitlyInjectedApiClient, logger: explicitlyInjectedLogger });

const explicitlyInjectedGeminiStreamService = new GeminiStreamService({
  apiClient: explicitlyInjectedApiClient,
  logger: explicitlyInjectedLogger
});



const explicitlyInjectedSavedPromptsService = new SavedPromptsService({
  savedPromptsManager: undefined,
  syncAdapter: new NetworkStorageSyncAdapter({
    transport: new ApiClientSyncTransport(explicitlyInjectedApiClient),
    offlineService: explicitlyInjectedOfflineService,
    networkStatusProvider: new BrowserNetworkStatusProvider(explicitlyInjectedPlatformService),
    retryStrategy: new DefaultOfflineRetryStrategy(),
    logger: explicitlyInjectedLogger,
    endpoint: "/api/prompts"
  }),
});

const explicitlyInjectedGeneralSettingsService = new GeneralSettingsService({
  storageFactory: explicitlyInjectedStorageFactory
});

const explicitlyInjectedAppAuthManager = new AppAuthManager({
  googleAuthService: explicitlyInjectedGoogleAuthService,
  authService: explicitlyInjectedAuthService,
  generalSettingsService: explicitlyInjectedGeneralSettingsService,
  logger: explicitlyInjectedLogger
});

const explicitlyInjectedWindowSecurityService = new WindowSecurityService({
    generalSettingsService: explicitlyInjectedGeneralSettingsService,
    platformService: explicitlyInjectedPlatformService
});

const explicitlyInjectedProjectService = new ProjectService({
  generalSettingsService: explicitlyInjectedGeneralSettingsService,
  idGenerator: explicitlyInjectedIdGenerator
});

const explicitlyInjectedDraftStateService = new DraftStateService({ logger: explicitlyInjectedLogger, storageFactory: explicitlyInjectedStorageFactory });

const explicitlyInjectedImageCompressor = new ImageCompressor({
  strategy: new CanvasImageCompressionStrategy({ idGenerator: explicitlyInjectedIdGenerator })
});

const explicitlyInjectedPromptTemplateService = new PromptTemplateService({
  builtinTemplates: BUILTIN_PROMPT_TEMPLATES,
  storageFactory: explicitlyInjectedStorageFactory,
  idGenerator: explicitlyInjectedIdGenerator
});

const explicitlyInjectedCodeGeneratorService = new CodeGeneratorService({
  generators: [
    new KotlinGenerator(),
    new TypeScriptGenerator(),
    new PythonGenerator(),
    new CurlGenerator()
  ]
});

const explicitlyInjectedClipboardService = new BrowserClipboardService(explicitlyInjectedLogger, explicitlyInjectedPlatformService);
const explicitlyInjectedFileDownloadService = new BrowserFileDownloadService(explicitlyInjectedLogger);

const defaultServices: IServices = {
  themeService: new ThemeService({ storageFactory: explicitlyInjectedStorageFactory }),
  promptTemplateService: explicitlyInjectedPromptTemplateService,
  authService: explicitlyInjectedAuthService,
  googleAuthService: explicitlyInjectedGoogleAuthService,
  appAuthManager: explicitlyInjectedAppAuthManager,
  offlineService: explicitlyInjectedOfflineService,
  apiClient: explicitlyInjectedApiClient,
  syncOrchestrator: explicitlyInjectedSyncOrchestrator,
  networkStatusProvider: new BrowserNetworkStatusProvider(explicitlyInjectedPlatformService),
  chatHistoryService: new ChatHistoryService({ logger: explicitlyInjectedLogger, storageFactory: explicitlyInjectedStorageFactory }),
  projectService: explicitlyInjectedProjectService,
  savedPromptsService: explicitlyInjectedSavedPromptsService,
  generalSettingsService: explicitlyInjectedGeneralSettingsService,
  draftStateService: explicitlyInjectedDraftStateService,
  julesStorageService: explicitlyInjectedJulesStorageService,
  julesClient: explicitlyInjectedJulesClient,
  julesSessionOrchestrator: explicitlyInjectedJulesSessionOrchestrator,
  speechVoicesService: explicitlyInjectedSpeechVoicesService,
  createSentenceSpeechQueue: (options) => new SentenceSpeechQueue(options),
  createSSEStreamParser: (onEvent) => new SSEStreamParser(onEvent),
  createBatchSelectionManager: () => new BatchSelectionManager(),
  geminiStreamService: explicitlyInjectedGeminiStreamService,
  keyVerificationService: explicitlyInjectedKeyVerificationService,
  stubsClient: explicitlyInjectedStubsClient,
  codeGeneratorService: explicitlyInjectedCodeGeneratorService,
  pwaInstallService: new PwaInstallService({ platformService: explicitlyInjectedPlatformService }),
  windowSecurityService: explicitlyInjectedWindowSecurityService,
  logger: explicitlyInjectedLogger,
  imageCompressor: explicitlyInjectedImageCompressor,
  clipboardService: explicitlyInjectedClipboardService,
  fileDownloadService: explicitlyInjectedFileDownloadService,
  platformService: explicitlyInjectedPlatformService,
  timeProvider: explicitlyInjectedTimeProvider,
  idGenerator: explicitlyInjectedIdGenerator,
};


const ServiceContext = createContext<IServices>(defaultServices);

export const ServiceProvider: React.FC<{
  services?: Partial<IServices>;
  children: ReactNode;
}> = ({ services, children }) => {
  const value = { ...defaultServices, ...services };
  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
};

export function useServices(): IServices {
  return useContext(ServiceContext);
}

export function createServices(overrides?: Partial<IServices>): IServices {
  return { ...defaultServices, ...overrides };
}
