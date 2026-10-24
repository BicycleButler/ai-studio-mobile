import React, { createContext, useContext, ReactNode } from "react";

import { IApiClient, defaultClient, apiFetch, apiFetchStream } from "../utils/apiClient";
import { SyncOrchestrator } from "../utils/syncOrchestrator";
import { DEFAULT_SYNC_HANDLERS } from "../utils/syncRegistry";
import { NetworkStorageSyncAdapter } from "../utils/storage/syncAdapter";
import { defaultLogger } from "../utils/logger";

import { IThemeService, defaultThemeService } from "./themeService";
import { IPromptTemplateService, defaultPromptTemplateService } from "./promptTemplateService";
import { IAuthService, defaultAuthService } from "./auth";
import { GoogleAuthService } from "./googleAuth";
import { IOfflineService } from "../utils/offlineService";
import { defaultOfflineService } from "../utils/offlineService";
import { INetworkStatusProvider } from "../utils/networkStatus";
import { defaultNetworkStatusProvider } from "../utils/networkStatus";
import { DefaultOfflineRetryStrategy } from "../utils/storage/offlineRetryStrategy";
import { defaultChatHistoryService, ChatHistoryService } from "./chatHistoryService";
import { ProjectService } from "../utils/storage/projects";
import { SavedPromptsService } from "../utils/storage/prompts";
import { GeneralSettingsService } from "../utils/storage/general";
import { DraftStateService } from "../utils/storage/draftState";
import { JulesStorageService } from "../utils/storage/jules";
import { JulesClient } from "./julesService";
import { defaultSpeechVoicesService, SpeechVoicesService } from "./speechVoices";
import { GeminiStreamService } from "./geminiStreamService";
import { defaultKeyVerificationService, KeyVerificationService } from "./keyVerification";
import { StubsClient } from "./stubsService";
import { defaultCodeGeneratorService, ICodeGeneratorService } from "./codeGeneratorService";
import { PwaInstallService, defaultPwaInstallService } from "./pwaInstallService";
import { WindowSecurityService } from "./windowSecurityService";

export interface IServices {
  themeService: IThemeService;
  promptTemplateService: IPromptTemplateService;
  authService: IAuthService;
  googleAuthService: GoogleAuthService;
  offlineService: IOfflineService;
  networkStatusProvider: INetworkStatusProvider;
  chatHistoryService: ChatHistoryService;
  projectService: ProjectService;
  savedPromptsService: SavedPromptsService;
  generalSettingsService: GeneralSettingsService;
  draftStateService: DraftStateService;
  julesStorageService: JulesStorageService;
  julesClient: JulesClient;
  speechVoicesService: SpeechVoicesService;
  geminiStreamService: GeminiStreamService;
  keyVerificationService: KeyVerificationService;
  stubsClient: StubsClient;
  codeGeneratorService: ICodeGeneratorService;
  apiClient: IApiClient;
  pwaInstallService: PwaInstallService;
  windowSecurityService: WindowSecurityService;
  syncOrchestrator: SyncOrchestrator;
  logger: typeof defaultLogger;
}


const explicitlyInjectedApiClient = defaultClient;
const explicitlyInjectedOfflineService = defaultOfflineService;

const explicitlyInjectedSyncOrchestrator = new SyncOrchestrator(
  explicitlyInjectedOfflineService,
  explicitlyInjectedApiClient,
  DEFAULT_SYNC_HANDLERS
);

const explicitlyInjectedGoogleAuthService = new GoogleAuthService({
  apiClient: explicitlyInjectedApiClient,
});


const explicitlyInjectedJulesClient = new JulesClient({
  getApiKey: () => explicitlyInjectedJulesStorageService.loadStoredJulesApiKey(),
  getSettings: () => explicitlyInjectedJulesStorageService.loadStoredJulesSettings(),
  apiClient: explicitlyInjectedApiClient,
});

const explicitlyInjectedStubsClient = new StubsClient(explicitlyInjectedApiClient);

const explicitlyInjectedGeminiStreamService = new GeminiStreamService(
  apiFetch,
  apiFetchStream,
  defaultLogger
);

const explicitlyInjectedJulesStorageService = new JulesStorageService({
  julesSessionsManager: undefined,
  syncAdapter: new NetworkStorageSyncAdapter({
    apiClient: explicitlyInjectedApiClient,
    offlineService: explicitlyInjectedOfflineService,
    networkStatusProvider: defaultNetworkStatusProvider,
    retryStrategy: new DefaultOfflineRetryStrategy(),
  }),
});

const explicitlyInjectedSavedPromptsService = new SavedPromptsService({
  savedPromptsManager: undefined,
  syncAdapter: new NetworkStorageSyncAdapter({
    apiClient: explicitlyInjectedApiClient,
    offlineService: explicitlyInjectedOfflineService,
    networkStatusProvider: defaultNetworkStatusProvider,
    retryStrategy: new DefaultOfflineRetryStrategy(),
  }),
});

const explicitlyInjectedGeneralSettingsService = new GeneralSettingsService();

const explicitlyInjectedWindowSecurityService = new WindowSecurityService({
    generalSettingsService: explicitlyInjectedGeneralSettingsService
});

const explicitlyInjectedProjectService = new ProjectService({
  generalSettingsService: explicitlyInjectedGeneralSettingsService,
});

const explicitlyInjectedDraftStateService = new DraftStateService();

const defaultServices: IServices = {
  themeService: defaultThemeService,
  promptTemplateService: defaultPromptTemplateService,
  authService: defaultAuthService,
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
  speechVoicesService: defaultSpeechVoicesService,
  geminiStreamService: explicitlyInjectedGeminiStreamService,
  keyVerificationService: defaultKeyVerificationService,
  stubsClient: explicitlyInjectedStubsClient,
  codeGeneratorService: defaultCodeGeneratorService,
  pwaInstallService: defaultPwaInstallService,
  windowSecurityService: explicitlyInjectedWindowSecurityService,
  logger: defaultLogger,
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
