import { IPlatformService, BrowserPlatformService } from "./platformService";
import React, { createContext, useContext, ReactNode } from "react";

import { IApiClient, ApiClient } from "../utils/apiClient";
import { SyncOrchestrator, ISyncOrchestrator } from "../utils/syncOrchestrator";
import { DEFAULT_SYNC_HANDLERS } from "../utils/syncRegistry";
import { NetworkStorageSyncAdapter, ApiClientSyncTransport } from "../utils/storage/syncAdapter";
import { defaultLogger, ILogger } from "../utils/logger";
import { defaultPlatformService } from "./platformService";

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

export interface IServices {
  themeService: IThemeService;
  promptTemplateService: IPromptTemplateService;
  authService: IAuthService;
  googleAuthService: IGoogleAuthService;
  offlineService: IOfflineService;
  networkStatusProvider: INetworkStatusProvider;
  chatHistoryService: IChatHistoryService;
  projectService: IProjectService;
  savedPromptsService: ISavedPromptsService;
  generalSettingsService: IGeneralSettingsService;
  draftStateService: IDraftStateService;
  julesStorageService: IJulesStorageService;
  julesClient: IJulesClient;
  speechVoicesService: ISpeechVoicesService;
  createSentenceSpeechQueue: (options: SentenceQueueOptions) => ISentenceSpeechQueue;
  createSSEStreamParser: (onEvent: import("../utils/sseParser").SSEEventCallback) => import("../utils/sseParser").ISSEStreamParser;
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
}


const explicitlyInjectedApiClient = new ApiClient();
const explicitlyInjectedOfflineService = new OfflineService({ queueStore: new (require('../utils/offlineQueueStore').OfflineQueueStore)({ storageKey: 'ai_studio_offline_mutations', storageAdapter: new (require('../utils/asyncStorage').IDBStorage)('ai_studio_db', 'offline_queue'), logger: defaultLogger }) });

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
  logger: defaultLogger
});

const explicitlyInjectedSpeechVoicesService = new SpeechVoicesService({
  apiClient: explicitlyInjectedApiClient,
  authService: explicitlyInjectedAuthService,
});

const explicitlyInjectedKeyVerificationService = new KeyVerificationService({
  apiClient: explicitlyInjectedApiClient,
  logger: defaultLogger
});


const explicitlyInjectedJulesClient = new JulesClient({
  getApiKey: () => explicitlyInjectedJulesStorageService.loadStoredJulesApiKey(),
  getSettings: () => explicitlyInjectedJulesStorageService.loadStoredJulesSettings(),
  apiClient: explicitlyInjectedApiClient,
});

const explicitlyInjectedStubsClient = new StubsClient({ apiClient: explicitlyInjectedApiClient, logger: defaultLogger });

const explicitlyInjectedGeminiStreamService = new GeminiStreamService({
  apiClient: explicitlyInjectedApiClient,
  logger: defaultLogger
});

const explicitlyInjectedJulesStorageService = new JulesStorageService({
  logger: defaultLogger,
  apiClient: explicitlyInjectedApiClient,
  julesSessionsManager: undefined,
  syncAdapter: new NetworkStorageSyncAdapter({
    transport: new ApiClientSyncTransport(explicitlyInjectedApiClient),
    offlineService: explicitlyInjectedOfflineService,
    networkStatusProvider: new BrowserNetworkStatusProvider(),
    retryStrategy: new DefaultOfflineRetryStrategy(),
    logger: defaultLogger,
    endpoint: "/api/jules/sessions"
  }),
});

const explicitlyInjectedSavedPromptsService = new SavedPromptsService({
  savedPromptsManager: undefined,
  syncAdapter: new NetworkStorageSyncAdapter({
    transport: new ApiClientSyncTransport(explicitlyInjectedApiClient),
    offlineService: explicitlyInjectedOfflineService,
    networkStatusProvider: new BrowserNetworkStatusProvider(),
    retryStrategy: new DefaultOfflineRetryStrategy(),
    logger: defaultLogger,
    endpoint: "/api/prompts"
  }),
});

const explicitlyInjectedGeneralSettingsService = new GeneralSettingsService({});

const explicitlyInjectedWindowSecurityService = new WindowSecurityService({
    generalSettingsService: explicitlyInjectedGeneralSettingsService,
    platformService: new BrowserPlatformService()
});

const explicitlyInjectedProjectService = new ProjectService({
  generalSettingsService: explicitlyInjectedGeneralSettingsService,
});

const explicitlyInjectedDraftStateService = new DraftStateService({ logger: defaultLogger });

const explicitlyInjectedImageCompressor = new ImageCompressor(new CanvasImageCompressionStrategy());

const explicitlyInjectedPromptTemplateService = new PromptTemplateService({
  builtinTemplates: BUILTIN_PROMPT_TEMPLATES,
});

const explicitlyInjectedCodeGeneratorService = new CodeGeneratorService({
  generators: [
    new KotlinGenerator(),
    new TypeScriptGenerator(),
    new PythonGenerator(),
    new CurlGenerator()
  ]
});

const explicitlyInjectedClipboardService = new BrowserClipboardService(defaultLogger, defaultPlatformService);
const explicitlyInjectedFileDownloadService = new BrowserFileDownloadService(defaultLogger);

const defaultServices: IServices = {
  themeService: new ThemeService(),
  promptTemplateService: explicitlyInjectedPromptTemplateService,
  authService: explicitlyInjectedAuthService,
  googleAuthService: explicitlyInjectedGoogleAuthService,
  offlineService: explicitlyInjectedOfflineService,
  apiClient: explicitlyInjectedApiClient,
  syncOrchestrator: explicitlyInjectedSyncOrchestrator,
  networkStatusProvider: new BrowserNetworkStatusProvider(),
  chatHistoryService: new ChatHistoryService({ logger: defaultLogger }),
  projectService: explicitlyInjectedProjectService,
  savedPromptsService: explicitlyInjectedSavedPromptsService,
  generalSettingsService: explicitlyInjectedGeneralSettingsService,
  draftStateService: explicitlyInjectedDraftStateService,
  julesStorageService: explicitlyInjectedJulesStorageService,
  julesClient: explicitlyInjectedJulesClient,
  speechVoicesService: explicitlyInjectedSpeechVoicesService,
  createSentenceSpeechQueue: (options) => new SentenceSpeechQueue(options),
  createSSEStreamParser: (onEvent) => new (require("../utils/sseParser")).SSEStreamParser(onEvent),
  geminiStreamService: explicitlyInjectedGeminiStreamService,
  keyVerificationService: explicitlyInjectedKeyVerificationService,
  stubsClient: explicitlyInjectedStubsClient,
  codeGeneratorService: explicitlyInjectedCodeGeneratorService,
  pwaInstallService: new PwaInstallService({ platformService: new BrowserPlatformService() }),
  windowSecurityService: explicitlyInjectedWindowSecurityService,
  logger: defaultLogger,
  imageCompressor: explicitlyInjectedImageCompressor,
  clipboardService: explicitlyInjectedClipboardService,
  fileDownloadService: explicitlyInjectedFileDownloadService,
  platformService: new BrowserPlatformService(),
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
