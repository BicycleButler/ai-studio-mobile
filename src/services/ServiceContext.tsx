import React, { createContext, useContext, ReactNode } from "react";

import { IApiClient, defaultClient } from "../utils/apiClient";
import { SyncOrchestrator, ISyncOrchestrator } from "../utils/syncOrchestrator";
import { DEFAULT_SYNC_HANDLERS } from "../utils/syncRegistry";
import { NetworkStorageSyncAdapter, ApiClientSyncTransport } from "../utils/storage/syncAdapter";
import { defaultLogger, ILogger } from "../utils/logger";

import { IThemeService, defaultThemeService } from "./themeService";
import { IPromptTemplateService, PromptTemplateService, BUILTIN_PROMPT_TEMPLATES } from "./promptTemplateService";
import { IAuthService, AuthService } from "./auth";
import { IGoogleAuthService, GoogleAuthService } from "./googleAuth";
import { IOfflineService } from "../utils/offlineService";
import { defaultOfflineService } from "../utils/offlineService";
import { INetworkStatusProvider } from "../utils/networkStatus";
import { defaultNetworkStatusProvider } from "../utils/networkStatus";
import { DefaultOfflineRetryStrategy } from "../utils/storage/offlineRetryStrategy";
import { defaultChatHistoryService, IChatHistoryService } from "./chatHistoryService";
import { ProjectService, IProjectService } from "../utils/storage/projects";
import { SavedPromptsService, ISavedPromptsService } from "../utils/storage/prompts";
import { GeneralSettingsService, IGeneralSettingsService } from "../utils/storage/general";
import { DraftStateService, IDraftStateService } from "../utils/storage/draftState";
import { JulesStorageService, IJulesStorageService } from "../utils/storage/jules";
import { IJulesClient, JulesClient } from "./julesService";
import { SpeechVoicesService, ISpeechVoicesService } from "./speechVoices";
import { GeminiStreamService, IGeminiStreamService } from "./geminiStreamService";
import { KeyVerificationService, IKeyVerificationService } from "./keyVerification";
import { StubsClient, IStubsClient } from "./stubsService";
import { CodeGeneratorService, ICodeGeneratorService } from "./codeGeneratorService";
import { PythonGenerator, TypeScriptGenerator, KotlinGenerator, CurlGenerator } from "./codeGenerators";
import { IPwaInstallService, defaultPwaInstallService } from "./pwaInstallService";
import { IWindowSecurityService, WindowSecurityService } from "./windowSecurityService";
import { IImageCompressor, defaultImageCompressor } from "../utils/imageCompressor";
import { IClipboardService, BrowserClipboardService } from "./clipboardService";
import { IFileDownloadService, BrowserFileDownloadService } from "./fileDownloadService";
import { IPlatformService, defaultPlatformService } from "./platformService";

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


const explicitlyInjectedApiClient = defaultClient;
const explicitlyInjectedOfflineService = defaultOfflineService;

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
    networkStatusProvider: defaultNetworkStatusProvider,
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
    networkStatusProvider: defaultNetworkStatusProvider,
    retryStrategy: new DefaultOfflineRetryStrategy(),
    logger: defaultLogger,
    endpoint: "/api/prompts"
  }),
});

const explicitlyInjectedGeneralSettingsService = new GeneralSettingsService({});

const explicitlyInjectedWindowSecurityService = new WindowSecurityService({
    generalSettingsService: explicitlyInjectedGeneralSettingsService,
    platformService: defaultPlatformService
});

const explicitlyInjectedProjectService = new ProjectService({
  generalSettingsService: explicitlyInjectedGeneralSettingsService,
});

const explicitlyInjectedDraftStateService = new DraftStateService({ logger: defaultLogger });

const explicitlyInjectedImageCompressor = defaultImageCompressor;

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

const explicitlyInjectedClipboardService = new BrowserClipboardService(defaultLogger);
const explicitlyInjectedFileDownloadService = new BrowserFileDownloadService(defaultLogger);

const defaultServices: IServices = {
  themeService: defaultThemeService,
  promptTemplateService: explicitlyInjectedPromptTemplateService,
  authService: explicitlyInjectedAuthService,
  googleAuthService: explicitlyInjectedGoogleAuthService,
  offlineService: explicitlyInjectedOfflineService,
  apiClient: explicitlyInjectedApiClient,
  syncOrchestrator: explicitlyInjectedSyncOrchestrator,
  networkStatusProvider: defaultNetworkStatusProvider,
  chatHistoryService: defaultChatHistoryService,
  projectService: explicitlyInjectedProjectService,
  savedPromptsService: explicitlyInjectedSavedPromptsService,
  generalSettingsService: explicitlyInjectedGeneralSettingsService,
  draftStateService: explicitlyInjectedDraftStateService,
  julesStorageService: explicitlyInjectedJulesStorageService,
  julesClient: explicitlyInjectedJulesClient,
  speechVoicesService: explicitlyInjectedSpeechVoicesService,
  geminiStreamService: explicitlyInjectedGeminiStreamService,
  keyVerificationService: explicitlyInjectedKeyVerificationService,
  stubsClient: explicitlyInjectedStubsClient,
  codeGeneratorService: explicitlyInjectedCodeGeneratorService,
  pwaInstallService: defaultPwaInstallService,
  windowSecurityService: explicitlyInjectedWindowSecurityService,
  logger: defaultLogger,
  imageCompressor: explicitlyInjectedImageCompressor,
  clipboardService: explicitlyInjectedClipboardService,
  fileDownloadService: explicitlyInjectedFileDownloadService,
  platformService: defaultPlatformService,
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
