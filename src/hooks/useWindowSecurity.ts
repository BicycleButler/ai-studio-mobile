import { useSyncExternalStore, useEffect, useCallback, useRef } from "react";
import { safeAddEventListener, safeAddDocumentListener } from "../utils/platform";
import { isFlagSecureEnabled, setFlagSecureEnabled } from "../utils/storage";

interface UseWindowSecurityOptions {
  isSensitiveScreenActive?: boolean;
}

// Global state for flagSecure
let currentFlagSecureEnabled = isFlagSecureEnabled();
let flagSecureListeners = new Set<() => void>();

function notifyFlagSecure() {
  for (const listener of flagSecureListeners) {
    listener();
  }
}

let isFlagSecureInitialized = false;

function subscribeFlagSecure(listener: () => void) {
  if (!isFlagSecureInitialized) {
    isFlagSecureInitialized = true;
    safeAddEventListener("flag_secure_changed" as keyof WindowEventMap, ((e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        currentFlagSecureEnabled = customEvent.detail;
        notifyFlagSecure();
      }
    }) as EventListener);
  }
  flagSecureListeners.add(listener as () => void);
  return () => {
    flagSecureListeners.delete(listener);
  };
}

function getFlagSecureSnapshot() {
  return currentFlagSecureEnabled;
}

// Global state for window visibility / focus
interface ShieldState {
  isShieldActive: boolean;
}

class ShieldStore {
  private isShieldActive = false;
  private flagSecureEnabled = currentFlagSecureEnabled;
  private listeners = new Set<() => void>();
  private timerRef: ReturnType<typeof setTimeout> | null = null;
  private cachedSnapshot: ShieldState = { isShieldActive: false };

  constructor() {
    this.initListeners();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private clearScheduledTimer() {
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = null;
    }
  }

  private updateShield(active: boolean) {
    if (this.isShieldActive !== active) {
      this.isShieldActive = active;
      this.notify();
    }
  }

  private initListeners() {
    safeAddDocumentListener("visibilitychange", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      this.clearScheduledTimer();
      if (document.visibilityState === "hidden") {
        this.updateShield(true);
      } else if (document.visibilityState === "visible") {
        this.timerRef = setTimeout(() => {
          this.updateShield(false);
        }, 120);
      }
    });

    safeAddEventListener("blur", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      if (this.evaluateSensitiveScreen()) {
        this.updateShield(true);
      }
    });

    safeAddEventListener("focus", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      this.clearScheduledTimer();
      this.timerRef = setTimeout(() => {
        this.updateShield(false);
      }, 120);
    });
  }

  public setContext(flagSecureEnabled: boolean) {
     const flagChanged = this.flagSecureEnabled !== flagSecureEnabled;
     this.flagSecureEnabled = flagSecureEnabled;

     if (!this.flagSecureEnabled) {
         this.updateShield(false);
     } else if (flagChanged) {
        // Evaluate immediately if we just turned on flag secure
        if (document.visibilityState === "hidden") {
             this.updateShield(true);
        }
     }
  }

  // We keep a set of currently registered screens and check if any are sensitive
  private sensitiveScreenRegistrations = new Set<string>();
  public registerScreen(id: string, isSensitive: boolean) {
     if (isSensitive) {
        this.sensitiveScreenRegistrations.add(id);
     } else {
        this.sensitiveScreenRegistrations.delete(id);
     }
  }
  public unregisterScreen(id: string) {
     this.sensitiveScreenRegistrations.delete(id);
  }
  private evaluateSensitiveScreen() {
      return this.sensitiveScreenRegistrations.size > 0;
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): ShieldState => {
    if (this.cachedSnapshot.isShieldActive !== this.isShieldActive) {
        this.cachedSnapshot = { isShieldActive: this.isShieldActive };
    }
    return this.cachedSnapshot;
  };
}

const shieldStore = new ShieldStore();


export function useWindowSecurity({
  isSensitiveScreenActive = false,
}: UseWindowSecurityOptions = {}) {

  const flagSecureEnabled = useSyncExternalStore(subscribeFlagSecure, getFlagSecureSnapshot, getFlagSecureSnapshot);

  // We need a stable ID for the lifetime of this hook mount
  const hookId = useRef(Math.random().toString(36).substring(7)).current;

  useEffect(() => {
     shieldStore.setContext(flagSecureEnabled);
     shieldStore.registerScreen(hookId, isSensitiveScreenActive);
     return () => {
         shieldStore.unregisterScreen(hookId);
     }
  }, [flagSecureEnabled, isSensitiveScreenActive, hookId]);

  const shieldState = useSyncExternalStore(shieldStore.subscribe, shieldStore.getSnapshot, shieldStore.getSnapshot);

  const toggleFlagSecure = useCallback((enabled: boolean) => {
    currentFlagSecureEnabled = enabled; // Synchronously update for immediate getSnapshot return
    setFlagSecureEnabled(enabled);
    notifyFlagSecure();
  }, []);

  return {
    isShieldActive: shieldState.isShieldActive,
    flagSecureEnabled,
    toggleFlagSecure,
  };
}
