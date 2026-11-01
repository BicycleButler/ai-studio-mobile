import { GoogleUser } from "../types";
import { STORAGE_KEYS, defaultStorageFactory, IStorageFactory } from "../utils/storage";
import { IMutableSingleton } from "../utils/storage/types";
import { IApiClient } from "../utils/apiClient";

import { IAuthProvider } from "./authProvider";
import { ILogger } from "../utils/logger";
import { defaultPlatformService, IPlatformService } from "./platformService";

export interface GoogleAuthServiceConfig {
  apiClient: IApiClient;
  authProvider?: IAuthProvider | null;
  storageSingleton?: IMutableSingleton<GoogleUser | null>;
  isBrowserEnv?: () => boolean;

  logger: ILogger;
  platformService?: IPlatformService;
  storageFactory?: IStorageFactory;
}

export interface IGoogleAuthService {
  setAuthProvider(provider: IAuthProvider): void;
  getAccessToken(): Promise<string | null>;
  loadStoredGoogleUser(): GoogleUser | null;
  saveStoredGoogleUser(user: GoogleUser | null): void;
  syncGoogleUserWithBackend(user: Partial<GoogleUser>): Promise<GoogleUser>;
  parseGoogleJwtPayload(token: string): { email?: string; name?: string; picture?: string; sub?: string } | null;
  googleSignIn(): Promise<{ user: GoogleUser; accessToken: string }>;
  initiateGoogleLogin(
    email?: string,
    name?: string,
    picture?: string,
    sub?: string,
    authSource?: "google_oauth" | "google_identity" | "google_account"
  ): Promise<GoogleUser>;
  initAuth(
    onAuthSuccess?: (user: GoogleUser, token: string | null) => void,
    onAuthFailure?: () => void
  ): (() => void);
  fetchCurrentGoogleUser(): Promise<GoogleUser | null>;
  logoutGoogleUser(): Promise<void>;
  openGoogleOAuthPopup(authUrl: string): Promise<{ token?: string; code?: string }>;
}

export class GoogleAuthService implements IGoogleAuthService {
  private cachedAccessToken: string | null = null;
  private isSigningIn = false;
  private currentAuthProvider: IAuthProvider | null = null;
  private apiClient: IApiClient;
  private googleUserSingleton: IMutableSingleton<GoogleUser | null>;
  private isBrowserEnv: () => boolean;

  private logger: ILogger;
  private platformService: IPlatformService;

  constructor(config: GoogleAuthServiceConfig) {
    this.apiClient = config.apiClient;
    this.currentAuthProvider = config?.authProvider || null;
    this.logger = config.logger;

    if (config?.storageSingleton) {
        this.googleUserSingleton = config.storageSingleton;
    } else {
        const factory = config?.storageFactory || defaultStorageFactory;
        this.googleUserSingleton = factory.createSingleton<GoogleUser | null>(
          STORAGE_KEYS.GOOGLE_USER,
          null
        );
    }
    this.platformService = config?.platformService || defaultPlatformService;
    this.isBrowserEnv = config?.isBrowserEnv || (() => this.platformService.isBrowserEnv());

  }

  public setAuthProvider(provider: IAuthProvider) {
    this.currentAuthProvider = provider;
  }

  public async getAccessToken(): Promise<string | null> {
    return this.cachedAccessToken;
  }

  public loadStoredGoogleUser(): GoogleUser | null {
    return this.googleUserSingleton.load();
  }

  public saveStoredGoogleUser(user: GoogleUser | null): void {
    this.googleUserSingleton.save(user);
    if (this.isBrowserEnv()) {
      this.platformService.getWindow()?.dispatchEvent(
        new CustomEvent("google_user_changed", { detail: user })
      );
    }
  }

  public async syncGoogleUserWithBackend(
    user: Partial<GoogleUser>
  ): Promise<GoogleUser> {
    try {
      const data = await this.apiClient.fetch<{ user: GoogleUser }>("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      }, "Failed to authenticate Google account with server.");

      this.saveStoredGoogleUser(data.user);
      return data.user;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error("Failed to authenticate Google account with server.");
    }
  }

  public parseGoogleJwtPayload(
    token: string
  ): { email?: string; name?: string; picture?: string; sub?: string } | null {
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  public async googleSignIn(): Promise<{ user: GoogleUser; accessToken: string }> {
    this.isSigningIn = true;
    try {
      if (!this.currentAuthProvider) throw new Error("No AuthProvider configured.");
      const { user, accessToken } = await this.currentAuthProvider.signIn();
      this.cachedAccessToken = accessToken;

      const syncedUser = await this.syncGoogleUserWithBackend({
        ...user,
        authSource: "google_oauth",
      });

      return { user: syncedUser, accessToken: this.cachedAccessToken || "" };
    } finally {
      this.isSigningIn = false;
    }
  }

  public async initiateGoogleLogin(
    email?: string,
    name?: string,
    picture?: string,
    sub?: string,
    authSource: "google_oauth" | "google_identity" | "google_account" = "google_oauth"
  ): Promise<GoogleUser> {
    if (email && email.trim()) {
      return this.syncGoogleUserWithBackend({
        email: email.trim(),
        name: name?.trim() || email.trim().split("@")[0],
        picture,
        sub,
        authSource,
      });
    }

    const { user } = await this.googleSignIn();
    return user;
  }

  public initAuth(
    onAuthSuccess?: (user: GoogleUser, token: string | null) => void,
    onAuthFailure?: () => void
  ): (() => void) {
    if (!this.currentAuthProvider) {
      if (onAuthFailure) onAuthFailure();
      return () => {};
    }
    return this.currentAuthProvider.onAuthStateChanged(async (user: Partial<GoogleUser> | null, _accessToken: string | null) => {
      if (user && user.email) {
        try {
          const synced = await this.syncGoogleUserWithBackend({
            ...user,
            authSource: "google_oauth",
          });
          if (onAuthSuccess) onAuthSuccess(synced, this.cachedAccessToken);
        } catch {
          const localUser: GoogleUser = {
            email: user.email,
            name: user.name || user.email.split("@")[0],
            picture: user.picture,
            sub: user.sub,
            authSource: "google_oauth",
            authenticatedAt: Date.now(),
            aiStudioSynced: true,
          };
          this.saveStoredGoogleUser(localUser);
          if (onAuthSuccess) onAuthSuccess(localUser, this.cachedAccessToken);
        }
      } else {
        if (!this.isSigningIn) {
          this.cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      }
    });
  }

  public async fetchCurrentGoogleUser(): Promise<GoogleUser | null> {
    try {
      const data = await this.apiClient.fetch<{ user: GoogleUser | null }>("/api/auth/user");
      if (data.user) {
        this.saveStoredGoogleUser(data.user);
        return data.user;
      }
      return null;
    } catch {
      return this.loadStoredGoogleUser();
    }
  }

  public async logoutGoogleUser(): Promise<void> {
    try {
      if (this.currentAuthProvider) await this.currentAuthProvider.signOut();
    } catch (err: unknown) {
      this.logger.warn("Auth provider signout error:", err);
    }
    this.cachedAccessToken = null;
    try {
      await this.apiClient.fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network error on logout
    }
    this.saveStoredGoogleUser(null);
  }

  public openGoogleOAuthPopup(authUrl: string): Promise<{ token?: string; code?: string }> {
    return new Promise((resolve, reject) => {
      const width = 540;
      const height = 650;
      const win = this.platformService.getWindow();
      const left = win ? win.screenX + (win.outerWidth - width) / 2 : 0;
      const top = win ? win.screenY + (win.outerHeight - height) / 2 : 0;

      const popup = win?.open(
        authUrl,
        "google_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        reject(new Error("Popup blocked. Please enable popups for this site and try again."));
        return;
      }

      const messageHandler = (event: MessageEvent) => {
        if (event.data && event.data.type === "OAUTH_AUTH_SUCCESS") {
          removeMessage();
          this.platformService.clearInterval(pollTimer);
          resolve({
            token: event.data.token,
            code: event.data.code,
          });
        }
      };

      const removeMessage = this.platformService.addEventListener("message", messageHandler);

      const pollTimer = this.platformService.setInterval(() => {
        if (popup.closed) {
          this.platformService.clearInterval(pollTimer);
          removeMessage();
          reject(new Error("Authentication popup closed before completing."));
        }
      }, 800) ;
    });
  }
}

