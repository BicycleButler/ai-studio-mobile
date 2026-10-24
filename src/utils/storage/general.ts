
import { StorageSingleton } from "./StorageSingleton";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeSetStorageString } from "./core";
import { IMutableSingleton } from "./types";
import { Observable } from "../observable";

export interface GeneralSettingsServiceConfig {
  apiKeySingleton?: IMutableSingleton<string>;
  flagSecureSingleton?: IMutableSingleton<boolean>;
}

export class GeneralSettingsService {
  private apiKeySingleton: IMutableSingleton<string>;
  private flagSecureSingleton: IMutableSingleton<boolean>;
  public flagSecureObservable: Observable<boolean>;

  constructor(config?: GeneralSettingsServiceConfig) {
    this.apiKeySingleton = config?.apiKeySingleton || new StorageSingleton<string>(
      STORAGE_KEYS.API_KEY,
      "",
      {
        transformIn: (key) => key.trim(),
        adapter: {
          get: (k, f) => safeGetStorageString(k, f as string),
          set: (k, v) => safeSetStorageString(k, v),
          remove: (k) => safeSetStorageString(k, ""),
        }
      }
    );

    this.flagSecureSingleton = config?.flagSecureSingleton || new StorageSingleton<boolean>(
      STORAGE_KEYS.FLAG_SECURE_ENABLED,
      true
    );

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

export const defaultGeneralSettingsService = new GeneralSettingsService();




