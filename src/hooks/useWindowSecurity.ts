import { useEffect, useCallback, useRef } from "react";
import { safeAddEventListener, safeAddDocumentListener } from "../utils/platform";
import { useServices } from "../services/ServiceContext";
import { defaultGeneralSettingsService } from "../utils/storage";
import { Observable } from "../utils/observable";
import { useStore } from "./useStore";

interface UseWindowSecurityOptions {
  isSensitiveScreenActive?: boolean;
}

// Global state for flagSecure
export const flagSecureObservable = new Observable<boolean>(defaultGeneralSettingsService.isFlagSecureEnabled());

let isFlagSecureInitialized = false;

function initFlagSecureListeners() {
  if (!isFlagSecureInitialized) {
    isFlagSecureInitialized = true;
    safeAddEventListener("flag_secure_changed" as keyof WindowEventMap, ((e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        flagSecureObservable.notify(customEvent.detail);
      }
    }) as EventListener);
  }
}

// Global state for window visibility / focus
interface ShieldState {
  isShieldActive: boolean;
}

class ShieldStore extends Observable<ShieldState> {
  private flagSecureEnabled: boolean;
  private timerRef: ReturnType<typeof setTimeout> | null = null;
  private sensitiveScreenRegistrations = new Set<string>();

  constructor() {
    super({ isShieldActive: false });
    this.flagSecureEnabled = flagSecureObservable.getSnapshot() || false;
    this.initListeners();
  }

  private clearScheduledTimer() {
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = null;
    }
  }

  private updateShield(active: boolean) {
    const current = this.getSnapshot();
    if (current && current.isShieldActive !== active) {
      this.notify({ isShieldActive: active });
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
}

const shieldStore = new ShieldStore();

export function useWindowSecurity({
  isSensitiveScreenActive = false,
}: UseWindowSecurityOptions = {}) {
  const { generalSettingsService } = useServices();

  // Need non-null assertion since we initialized it with a value
  const flagSecureEnabled = useStore(flagSecureObservable, initFlagSecureListeners)!;

  // We need a stable ID for the lifetime of this hook mount
  const hookId = useRef(Math.random().toString(36).substring(7)).current;

  useEffect(() => {
     shieldStore.setContext(flagSecureEnabled);
     shieldStore.registerScreen(hookId, isSensitiveScreenActive);
     return () => {
         shieldStore.unregisterScreen(hookId);
     }
  }, [flagSecureEnabled, isSensitiveScreenActive, hookId]);

  const shieldState = useStore(shieldStore);

  const toggleFlagSecure = useCallback((enabled: boolean) => {
    // Synchronously update for immediate getSnapshot return and state updates
    flagSecureObservable.notifySync(enabled);
    generalSettingsService.setFlagSecureEnabled(enabled);
  }, []);

  return {
    isShieldActive: shieldState?.isShieldActive || false,
    flagSecureEnabled,
    toggleFlagSecure,
  };
}
