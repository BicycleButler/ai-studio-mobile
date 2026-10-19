import { isBrowserEnvironment, getSafeWindow } from "../platform";
import { StorageSingleton } from "./StorageSingleton";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeSetStorageString } from "./core";

// API Key management
const apiKeySingleton = new StorageSingleton<string>(
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

export function loadStoredApiKey(): string {
  return apiKeySingleton.load();
}

export function saveStoredApiKey(key: string): void {
  if (key.trim()) {
    apiKeySingleton.save(key);
  } else {
    apiKeySingleton.clear();
  }
}

// Flag Secure management
const flagSecureSingleton = new StorageSingleton<boolean>(
  STORAGE_KEYS.FLAG_SECURE_ENABLED,
  true
);

export function isFlagSecureEnabled(): boolean {
  return flagSecureSingleton.load();
}

export function setFlagSecureEnabled(enabled: boolean): void {
  flagSecureSingleton.save(enabled);
  if (isBrowserEnvironment()) {
    getSafeWindow()?.dispatchEvent(new CustomEvent("flag_secure_changed", { detail: enabled }));
  }
}
