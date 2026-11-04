import { ApiClient, IApiClient } from "../src/utils/apiClient";
import { ServerJulesClient, IServerJulesClient } from "./julesClient";
import { ILogger, defaultLogger } from "../src/utils/logger";
import { IProcessRunner, ProcessRunner } from "./utils/processRunner";

export interface IServerServices {
  apiClient: IApiClient;
  julesClient: IServerJulesClient;
  logger: ILogger;
  processRunner: IProcessRunner;
}

export interface IServerContext {
  services: IServerServices;
}

export class ServerContext implements IServerContext {
  public services: IServerServices;

  constructor(overrides?: Partial<IServerServices>) {
    const logger = overrides?.logger || defaultLogger;
    const apiClient = overrides?.apiClient || new ApiClient();
    const processRunner = overrides?.processRunner || new ProcessRunner();
    const julesClient = overrides?.julesClient || new ServerJulesClient({ apiClient, logger });

    this.services = {
      apiClient,
      logger,
      processRunner,
      julesClient
    };
  }
}

export const defaultServerContext: IServerContext = new ServerContext();
