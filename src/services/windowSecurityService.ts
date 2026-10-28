import { getSafeDocument, safeAddEventListener, safeAddDocumentListener } from "../utils/platform";
import { Observable } from "../utils/observable";
import { GeneralSettingsService } from "../utils/storage/general";
import { defaultPlatformService, IPlatformService } from "./platformService";

export interface ShieldState {
  isShieldActive: boolean;
}

export interface WindowSecurityServiceConfig {
    generalSettingsService: GeneralSettingsService;
    getSafeDoc?: typeof getSafeDocument;
    addEventListener?: typeof safeAddEventListener;
    addDocumentListener?: typeof safeAddDocumentListener;
}

export interface IWindowSecurityService {
  shieldStore: Observable<ShieldState>;
  registerScreen(id: string, isSensitive: boolean): void;
  unregisterScreen(id: string): void;
}

export class WindowSecurityService implements IWindowSecurityService {
  public shieldStore: Observable<ShieldState>;
  private generalSettingsService: GeneralSettingsService;
  private flagSecureEnabled: boolean;
  private timerRef: ReturnType<typeof setTimeout> | null = null;
  private sensitiveScreenRegistrations = new Set<string>();
  private getSafeDoc: typeof getSafeDocument;
  private addEventListener: typeof safeAddEventListener;
  private addDocumentListener: typeof safeAddDocumentListener;
  private platformService: IPlatformService;

  constructor(config: WindowSecurityServiceConfig & { platformService?: IPlatformService }) {
    this.generalSettingsService = config.generalSettingsService;
    this.getSafeDoc = config.getSafeDoc || getSafeDocument;
    this.addEventListener = config.addEventListener || safeAddEventListener;
    this.addDocumentListener = config.addDocumentListener || safeAddDocumentListener;

    this.platformService = config.platformService || defaultPlatformService;
    this.shieldStore = new Observable<ShieldState>({ isShieldActive: false });
    this.flagSecureEnabled = this.generalSettingsService.flagSecureObservable.getSnapshot() || false;
    this.initListeners();
  }

  private clearScheduledTimer() {
    if (this.timerRef) {
      this.platformService.clearTimeout(this.timerRef as unknown as number);
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
    this.addDocumentListener("visibilitychange", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      this.clearScheduledTimer();
      if (this.getSafeDoc()?.visibilityState === "hidden") {
        this.updateShield(true);
      } else if (this.getSafeDoc()?.visibilityState === "visible") {
        this.timerRef = this.platformService.setTimeout(() => {
          this.updateShield(false);
        }, 120) as unknown as ReturnType<typeof setTimeout>;
      }
    });

    this.addEventListener("blur", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      if (this.evaluateSensitiveScreen()) {
        this.updateShield(true);
      }
    });

    this.addEventListener("focus", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      this.clearScheduledTimer();
      this.timerRef = this.platformService.setTimeout(() => {
        this.updateShield(false);
      }, 120) as unknown as ReturnType<typeof setTimeout>;
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
        if (this.getSafeDoc()?.visibilityState === "hidden") {
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
