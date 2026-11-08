import { IPlatformService } from "./IPlatformService";
import { Observable, IObservable } from "../utils/observable";
import { IGeneralSettingsService } from "../utils/storage/general";
import { BrowserPlatformService } from "../services/platformService"


export interface ShieldState {
  isShieldActive: boolean;
}

export interface WindowSecurityServiceConfig {
    generalSettingsService: IGeneralSettingsService;
    platformService?: IPlatformService;
}

export interface IWindowSecurityService {
  shieldStore: IObservable<ShieldState>;
  registerScreen(id: string, isSensitive: boolean): void;
  unregisterScreen(id: string): void;
}

export class WindowSecurityService implements IWindowSecurityService {
  public shieldStore: IObservable<ShieldState>;
  private generalSettingsService: IGeneralSettingsService;
  private flagSecureEnabled: boolean;
  private timerRef: unknown = null;
  private sensitiveScreenRegistrations = new Set<string>();
  private platformService: IPlatformService;

  constructor(config: WindowSecurityServiceConfig) {
    this.generalSettingsService = config.generalSettingsService;
    this.platformService = config.platformService || new BrowserPlatformService();

    this.shieldStore = new Observable<ShieldState>({ isShieldActive: false });
    this.flagSecureEnabled = this.generalSettingsService.flagSecureObservable.getSnapshot() || false;
    this.initListeners();
  }

  private clearScheduledTimer() {
    if (this.timerRef) {
      this.platformService.clearTimeout(this.timerRef);
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
    this.platformService.addDocumentListener("visibilitychange", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      this.clearScheduledTimer();
      if (this.platformService.getDocument()?.visibilityState === "hidden") {
        this.updateShield(true);
      } else if (this.platformService.getDocument()?.visibilityState === "visible") {
        this.timerRef = this.platformService.setTimeout(() => {
          this.updateShield(false);
        }, 120) ;
      }
    });

    this.platformService.addEventListener("blur", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      if (this.evaluateSensitiveScreen()) {
        this.updateShield(true);
      }
    });

    this.platformService.addEventListener("focus", () => {
      if (!this.flagSecureEnabled) {
          this.updateShield(false);
          return;
      }
      this.clearScheduledTimer();
      this.timerRef = this.platformService.setTimeout(() => {
        this.updateShield(false);
      }, 120) ;
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
        if (this.platformService.getDocument()?.visibilityState === "hidden") {
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
