import { GoogleUser } from "../types";
import { IGoogleAuthService } from "./googleAuth";
import { IAuthService } from "./auth";
import { IGeneralSettingsService } from "../utils/storage/general";
import { ILogger } from "../utils/logger";

export interface IAppAuthManager {
  getGoogleUser(): GoogleUser | null;
  hasServerKey(): boolean;
  getCustomApiKey(): string;
  hasAnyApiKey(): boolean;
  saveCustomApiKey(key: string): void;
  initiateGoogleLogin(email?: string, name?: string): Promise<GoogleUser>;
  logoutGoogleUser(): Promise<void>;
  refreshServerAuth(): Promise<void>;
  initializeAuth(
    onServerKeyUpdate: (hasKey: boolean) => void,
    onUserUpdate: (user: GoogleUser | null) => void
  ): () => void;
}

export interface AppAuthManagerConfig {
  googleAuthService: IGoogleAuthService;
  authService: IAuthService;
  generalSettingsService: IGeneralSettingsService;
  logger: ILogger;
}

export class AppAuthManager implements IAppAuthManager {
  private googleAuthService: IGoogleAuthService;
  private authService: IAuthService;
  private generalSettingsService: IGeneralSettingsService;
  private logger: ILogger;

  private _hasServerKey: boolean = false;
  private _googleUser: GoogleUser | null = null;

  private serverKeyUpdateListeners: Set<(hasKey: boolean) => void> = new Set();
  private userUpdateListeners: Set<(user: GoogleUser | null) => void> = new Set();
  private _googleAuthUnsubscribe: (() => void) | null = null;

  constructor(config: AppAuthManagerConfig) {
    this.googleAuthService = config.googleAuthService;
    this.authService = config.authService;
    this.generalSettingsService = config.generalSettingsService;
    this.logger = config.logger;
    this._googleUser = this.googleAuthService.loadStoredGoogleUser();
  }

  public getGoogleUser(): GoogleUser | null {
    return this._googleUser;
  }

  public hasServerKey(): boolean {
    return this._hasServerKey;
  }

  public getCustomApiKey(): string {
    return this.generalSettingsService.loadStoredApiKey();
  }

  public hasAnyApiKey(): boolean {
    return Boolean(this._googleUser || this.getCustomApiKey().trim() || this._hasServerKey);
  }

  public saveCustomApiKey(key: string): void {
    this.generalSettingsService.saveStoredApiKey(key);
  }

  public async initiateGoogleLogin(email?: string, name?: string): Promise<GoogleUser> {
    try {
      const user = await this.googleAuthService.initiateGoogleLogin(email, name);
      this._googleUser = user;
      this.notifyUserListeners(user);
      return user;
    } catch (err) {
      this.logger.error("Google login failed", err);
      throw err;
    }
  }

  public async logoutGoogleUser(): Promise<void> {
    try {
      await this.googleAuthService.logoutGoogleUser();
      this._googleUser = null;
      this.notifyUserListeners(null);
    } catch (err) {
      this.logger.error("Logout failed", err);
      throw err;
    }
  }

  public async refreshServerAuth(): Promise<void> {
    try {
      const data = await this.authService.fetchServerHealth();
      this._hasServerKey = Boolean(data.hasServerApiKey);
      this.notifyServerKeyListeners(this._hasServerKey);
    } catch (err) {
      this.logger.error("Failed to refresh server auth", err);
    }
  }

  private notifyServerKeyListeners(hasKey: boolean) {
    this.serverKeyUpdateListeners.forEach(listener => listener(hasKey));
  }

  private notifyUserListeners(user: GoogleUser | null) {
     this.userUpdateListeners.forEach(listener => listener(user));
  }

  public initializeAuth(
    onServerKeyUpdate: (hasKey: boolean) => void,
    onUserUpdate: (user: GoogleUser | null) => void
  ): () => void {

    this.serverKeyUpdateListeners.add(onServerKeyUpdate);
    this.userUpdateListeners.add(onUserUpdate);

    // We initially need to check the server health to know if a server key exists
    this.refreshServerAuth();

    if (!this._googleAuthUnsubscribe) {
        this._googleAuthUnsubscribe = this.googleAuthService.initAuth((user) => {
            this._googleUser = user;
            this.notifyUserListeners(user);
        }, () => {
            this._googleUser = null;
            this.notifyUserListeners(null);
        });
    }

    return () => {
      this.serverKeyUpdateListeners.delete(onServerKeyUpdate);
      this.userUpdateListeners.delete(onUserUpdate);
    };
  }
}
