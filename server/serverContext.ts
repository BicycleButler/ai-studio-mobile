import { DefaultUrlBuilder } from "../src/utils/urlUtils";
import { DefaultResponseParser } from "../src/utils/apiResponseParser";
import { InterceptorManager } from "../src/utils/apiClientInterceptors";
import { ApiClient, IApiClient } from "../src/utils/apiClient";
import { ILogger, DefaultLoggerFactory } from "../src/utils/logger";
import { IProcessRunner, ProcessRunner } from "./utils/processRunner";
import { ITimeProvider, DefaultTimeProvider } from "../src/utils/timeProvider";

export interface IServerServices {
  apiClient: IApiClient;
  logger: ILogger;
  processRunner: IProcessRunner;
  timeProvider: ITimeProvider;
}

export interface IServerContext {
  services: IServerServices;
}

export class ServerContext implements IServerContext {
  public services: IServerServices;

  constructor(overrides?: Partial<IServerServices>) {
    const logger = overrides?.logger || new DefaultLoggerFactory().createLogger();
    const apiClient = overrides?.apiClient || new ApiClient({ interceptorManager: new InterceptorManager(), responseParser: new DefaultResponseParser(), urlBuilder: new DefaultUrlBuilder() });
    const timeProvider = overrides?.timeProvider || new DefaultTimeProvider();
    const processRunner = overrides?.processRunner || new ProcessRunner(timeProvider);

    this.services = {
      apiClient,
      logger,
      processRunner,
      timeProvider
    };
  }
}

export const defaultServerContext: IServerContext = new ServerContext();
