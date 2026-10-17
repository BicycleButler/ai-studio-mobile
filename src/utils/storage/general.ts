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
    getter: safeGetStorageString as (key: string, fallback: string) => string,
    setter: safeSetStorageString as (key: string, value: string) => void,
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
