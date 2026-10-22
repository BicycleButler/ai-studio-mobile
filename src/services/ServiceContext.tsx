import React, { createContext, useContext, ReactNode } from "react";
import { IThemeService, defaultThemeService } from "./themeService";
import { IPromptTemplateService, defaultPromptTemplateService } from "./promptTemplateService";
import { IAuthService, defaultAuthService } from "./auth";
import { GoogleAuthService, defaultGoogleAuthService } from "./googleAuth";
import { IOfflineService } from "../utils/offlineService";
import { defaultOfflineService } from "../utils/offlineService";
import { INetworkStatusProvider } from "../utils/networkStatus";
import { defaultNetworkStatusProvider } from "../utils/networkStatus";
import { defaultChatHistoryService, ChatHistoryService } from "./chatHistoryService";
import { defaultProjectService, ProjectService } from "../utils/storage/projects";
import { defaultSavedPromptsService, SavedPromptsService } from "../utils/storage/prompts";
import { defaultGeneralSettingsService, GeneralSettingsService } from "../utils/storage/general";
import { defaultDraftStateService, DraftStateService } from "../utils/storage/draftState";
import { defaultJulesStorageService, JulesStorageService } from "../utils/storage/jules";
import { defaultSpeechVoicesService, SpeechVoicesService } from "./speechVoices";
import { defaultGeminiStreamService, GeminiStreamService } from "./geminiStreamService";
import { defaultKeyVerificationService, KeyVerificationService } from "./keyVerification";
import { defaultStubsClient, StubsClient } from "./stubsService";

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
  speechVoicesService: SpeechVoicesService;
  geminiStreamService: GeminiStreamService;
  keyVerificationService: KeyVerificationService;
  stubsClient: StubsClient;
}

const defaultServices: IServices = {
  themeService: defaultThemeService,
  promptTemplateService: defaultPromptTemplateService,
  authService: defaultAuthService,
  googleAuthService: defaultGoogleAuthService,
  offlineService: defaultOfflineService,
  networkStatusProvider: defaultNetworkStatusProvider,
  chatHistoryService: defaultChatHistoryService,
  projectService: defaultProjectService,
  savedPromptsService: defaultSavedPromptsService,
  generalSettingsService: defaultGeneralSettingsService,
  draftStateService: defaultDraftStateService,
  julesStorageService: defaultJulesStorageService,
  speechVoicesService: defaultSpeechVoicesService,
  geminiStreamService: defaultGeminiStreamService,
  keyVerificationService: defaultKeyVerificationService,
  stubsClient: defaultStubsClient,
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
