import { IPlatformService } from "./IPlatformService";
import { ITimeProvider, DefaultTimeProvider } from "../utils/timeProvider";
import { GoogleUser } from "../types";
import { STORAGE_KEYS, DefaultStorageFactory, IStorageFactory } from "../utils/storage";
import { IMutableSingleton } from "../utils/storage/types";
import { IApiClient } from "../utils/apiClient";

import { AuthSignInResult, IAuthProvider } from "./authProvider";
import { ILogger } from "../utils/logger";
import { BrowserPlatformService } from "../services/platformService"


export interface GoogleAuthServiceConfig {
  apiClient: IApiClient;
  authProvider?: IAuthProvider | null;
  storageSingleton?: IMutableSingleton<GoogleUser | null>;
  isBrowserEnv?: () => boolean;

  logger: ILogger;
  platformService?: IPlatformService;
  storageFactory?: IStorageFactory;
  timeProvider?: ITimeProvider;
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
  supportsScopedSignIn?(): boolean;
  signInWithScopes?(scopes: string[]): Promise<AuthSignInResult>;
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
  private timeProvider: ITimeProvider;

  constructor(config: GoogleAuthServiceConfig) {
    this.apiClient = config.apiClient;
    this.currentAuthProvider = config?.authProvider || null;
    this.logger = config.logger;
    this.timeProvider = config.timeProvider || new DefaultTimeProvider();

    if (config?.storageSingleton) {
        this.googleUserSingleton = config.storageSingleton;
    } else {
        const factory = config?.storageFactory || new DefaultStorageFactory();
        this.googleUserSingleton = factory.createSingleton<GoogleUser | null>(
          STORAGE_KEYS.GOOGLE_USER,
          null
        );
    }
    this.platformService = config?.platformService || new BrowserPlatformService();
    this.isBrowserEnv = config?.isBrowserEnv || (() => this.platformService.isBrowserEnv());

  }

  public setAuthProvider(provider: IAuthProvider) {
    this.currentAuthProvider = provider;
  }

  public supportsScopedSignIn(): boolean {
    return Boolean(this.isBrowserEnv() && this.currentAuthProvider?.signInWithScopes);
  }

  public async signInWithScopes(scopes: string[]): Promise<AuthSignInResult> {
    if (!this.currentAuthProvider?.signInWithScopes) {
      throw new Error("Scoped Google sign-in is not available in this environment.");
    }
    this.isSigningIn = true;
    try {
      const result = await this.currentAuthProvider.signInWithScopes(scopes);
      if (!result.accessToken) {
        throw new Error("Google did not return an OAuth access token for the requested permissions.");
      }
      this.cachedAccessToken = result.accessToken;
      await this.syncGoogleUserWithBackend({
        ...result.user,
        authSource: "google_oauth",
        idToken: result.idToken,
        accessToken: result.accessToken,
      }).catch(() => {
        // Session sync is best-effort; caller still receives the scoped OAuth token
      });
      return result;
    } finally {
      this.isSigningIn = false;
    }
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
    user: Partial<GoogleUser> & { idToken?: string; accessToken?: string }
  ): Promise<GoogleUser> {
    try {
      let idToken = user.idToken;
      if (!idToken && this.currentAuthProvider?.getIdToken) {
        try {
          idToken = (await this.currentAuthProvider.getIdToken()) || undefined;
        } catch {
          // ignore token retrieval error
        }
      }
      const accessToken = user.accessToken || this.cachedAccessToken || undefined;
      const payload = {
        ...user,
        ...(idToken ? { idToken } : {}),
        ...(accessToken ? { accessToken } : {}),
      };

      const data = await this.apiClient.fetch<{ user: GoogleUser }>("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
      const { user, accessToken, idToken } = await this.currentAuthProvider.signIn();
      this.cachedAccessToken = accessToken;

      const syncedUser = await this.syncGoogleUserWithBackend({
        ...user,
        authSource: "google_oauth",
        idToken,
        accessToken,
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
            authenticatedAt: this.timeProvider.now(),
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
        if (!event.data) return;
        if (event.data.type === "OAUTH_AUTH_SUCCESS") {
          removeMessage();
          this.platformService.clearInterval(pollTimer);
          resolve({
            token: event.data.token,
            code: event.data.code,
          });
        } else if (event.data.type === "OAUTH_AUTH_ERROR" || event.data.error) {
          removeMessage();
          this.platformService.clearInterval(pollTimer);
          reject(new Error(String(event.data.error || "Authentication failed.")));
        }
      };

      const removeMessage = this.platformService.addEventListener("message", messageHandler);

      const pollTimer = this.platformService.setInterval(() => {
        let isClosed = false;
        try {
          isClosed = Boolean(popup.closed);
        } catch {
          // Ignore Cross-Origin-Opener-Policy errors inspecting popup.closed
        }
        if (isClosed) {
          this.platformService.clearInterval(pollTimer);
          removeMessage();
          reject(new Error("Authentication popup closed before completing."));
        }
      }, 800);
    });
  }
}

