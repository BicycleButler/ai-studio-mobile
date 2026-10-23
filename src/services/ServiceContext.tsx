import React, { createContext, useContext, ReactNode } from "react";

import { IApiClient, defaultClient, apiFetch, apiFetchStream } from "../utils/apiClient";
import { SyncOrchestrator } from "../utils/syncOrchestrator";
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
import { defaultChatHistoryService, ChatHistoryService } from "./chatHistoryService";
import { defaultProjectService, ProjectService } from "../utils/storage/projects";
import { SavedPromptsService } from "../utils/storage/prompts";
import { defaultGeneralSettingsService, GeneralSettingsService } from "../utils/storage/general";
import { defaultDraftStateService, DraftStateService } from "../utils/storage/draftState";
import { JulesStorageService } from "../utils/storage/jules";
import { JulesClient } from "./julesService";
import { defaultSpeechVoicesService, SpeechVoicesService } from "./speechVoices";
import { GeminiStreamService } from "./geminiStreamService";
import { defaultKeyVerificationService, KeyVerificationService } from "./keyVerification";
import { StubsClient } from "./stubsService";
import { defaultCodeGeneratorService, ICodeGeneratorService } from "./codeGeneratorService";

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
  syncOrchestrator: SyncOrchestrator;
}


const explicitlyInjectedApiClient = defaultClient;
const explicitlyInjectedOfflineService = defaultOfflineService;

const explicitlyInjectedSyncOrchestrator = new SyncOrchestrator(
  explicitlyInjectedOfflineService,
  explicitlyInjectedApiClient
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
  syncAdapter: new NetworkStorageSyncAdapter({
    apiClient: explicitlyInjectedApiClient,
    offlineService: explicitlyInjectedOfflineService,
  }),
});

const explicitlyInjectedSavedPromptsService = new SavedPromptsService({
  syncAdapter: new NetworkStorageSyncAdapter({
    apiClient: explicitlyInjectedApiClient,
    offlineService: explicitlyInjectedOfflineService,
  }),
});

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
  projectService: defaultProjectService,
  savedPromptsService: explicitlyInjectedSavedPromptsService,
  generalSettingsService: defaultGeneralSettingsService,
  draftStateService: defaultDraftStateService,
  julesStorageService: explicitlyInjectedJulesStorageService,
  julesClient: explicitlyInjectedJulesClient,
  speechVoicesService: defaultSpeechVoicesService,
  geminiStreamService: explicitlyInjectedGeminiStreamService,
  keyVerificationService: defaultKeyVerificationService,
  stubsClient: explicitlyInjectedStubsClient,
  codeGeneratorService: defaultCodeGeneratorService,
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
