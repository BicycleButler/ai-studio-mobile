import { safeAddEventListener, safeAddDocumentListener } from "../utils/platform";
import { Observable } from "../utils/observable";
import { GeneralSettingsService } from "../utils/storage/general";

export interface ShieldState {
  isShieldActive: boolean;
}

export interface WindowSecurityServiceConfig {
    generalSettingsService: GeneralSettingsService;
}

export class WindowSecurityService {
  public shieldStore: Observable<ShieldState>;
  private generalSettingsService: GeneralSettingsService;
  private flagSecureEnabled: boolean;
  private timerRef: ReturnType<typeof setTimeout> | null = null;
  private sensitiveScreenRegistrations = new Set<string>();

  constructor(config: WindowSecurityServiceConfig) {
    this.generalSettingsService = config.generalSettingsService;
    this.shieldStore = new Observable<ShieldState>({ isShieldActive: false });
    this.flagSecureEnabled = this.generalSettingsService.flagSecureObservable.getSnapshot() || false;
    this.initListeners();
  }

  private clearScheduledTimer() {
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = null;
    }
  }

  private updateShield(active: boolean) {
    const current = this.shieldStore.getSnapshot();
    if (current && current.isShieldActive !== active) {
      this.shieldStore.notify({ isShieldActive: active });
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

    // Subscribe to general settings to keep in sync
    this.generalSettingsService.flagSecureObservable.subscribe((enabled) => {
        this.setContext(enabled);
    });
  }

  private setContext(flagSecureEnabled: boolean) {
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
