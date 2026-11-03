import { createDefaultStorageInstance } from "./core";

import { defaultStorageFactory, IStorageFactory } from "./StorageFactory";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeSetStorageString } from "./core";
import { IMutableSingleton } from "./types";
import { Observable, IObservable } from "../observable";

export interface IGeneralSettingsService {
  flagSecureObservable: IObservable<boolean>;
  loadStoredApiKey(): string;
  saveStoredApiKey(key: string): void;
  isFlagSecureEnabled(): boolean;
  setFlagSecureEnabled(enabled: boolean): void;
}

export interface GeneralSettingsServiceConfig {
  apiKeySingleton?: IMutableSingleton<string>;
  flagSecureSingleton?: IMutableSingleton<boolean>;
  storageFactory?: IStorageFactory;
}

export class GeneralSettingsService implements IGeneralSettingsService {
  private apiKeySingleton: IMutableSingleton<string>;
  private flagSecureSingleton: IMutableSingleton<boolean>;
  public flagSecureObservable: IObservable<boolean>;

  constructor(config: GeneralSettingsServiceConfig) {
    if (config?.apiKeySingleton) {
        this.apiKeySingleton = config.apiKeySingleton;
    } else {
        const factory = config?.storageFactory || defaultStorageFactory;
        this.apiKeySingleton = factory.createSingleton<string>(
          STORAGE_KEYS.API_KEY,
          "",
          {
            transformIn: (key) => key.trim(),
            adapter: {
              get: (k, f) => safeGetStorageString(k, f as string, (factory as unknown as { storageInstance?: Storage }).storageInstance || createDefaultStorageInstance()),
              set: (k, v) => safeSetStorageString(k, v, (factory as unknown as { storageInstance?: Storage }).storageInstance || createDefaultStorageInstance()),
              remove: (k) => safeSetStorageString(k, "", (factory as unknown as { storageInstance?: Storage }).storageInstance || createDefaultStorageInstance()),
            }
          }
        );
    }

    if (config?.flagSecureSingleton) {
        this.flagSecureSingleton = config.flagSecureSingleton;
    } else {
        const factory = config?.storageFactory || defaultStorageFactory;
        this.flagSecureSingleton = factory.createSingleton<boolean>(
          STORAGE_KEYS.FLAG_SECURE_ENABLED,
          true
        );
    }

    this.flagSecureObservable = new Observable<boolean>(this.flagSecureSingleton.load());
  }

  public loadStoredApiKey(): string {
    return this.apiKeySingleton.load();
  }

  public saveStoredApiKey(key: string): void {
    if (key.trim()) {
      this.apiKeySingleton.save(key);
    } else {
      this.apiKeySingleton.clear();
    }
  }

  public isFlagSecureEnabled(): boolean {
    return this.flagSecureSingleton.load();
  }

  public setFlagSecureEnabled(enabled: boolean): void {
    this.flagSecureSingleton.save(enabled);
    this.flagSecureObservable.notify(enabled);
  }
}

export const defaultGeneralSettingsService = new GeneralSettingsService({});




