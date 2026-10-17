import { GoogleUser } from "../types";
import { STORAGE_KEYS, StorageSingleton } from "../utils/storage";
import { apiFetch } from "../utils/apiClient";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  Auth
} from "firebase/auth";
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { isBrowserEnvironment, getSafeWindow, safeAddEventListener } from "../utils/platform";
import firebaseConfig from "../../firebase-applet-config.json";

class GoogleAuthManager {
  private googleUserSingleton = new StorageSingleton<GoogleUser | null>(
    STORAGE_KEYS.GOOGLE_USER,
    null
  );

  private cachedAccessToken: string | null = null;
  private isSigningIn = false;
  private firebaseAppInstance: FirebaseApp | null = null;
  private firebaseAuthInstance: Auth | null = null;
  private googleAuthProviderInstance: GoogleAuthProvider | null = null;

  public getFirebaseAuth(): Auth | null {
    if (this.firebaseAuthInstance) return this.firebaseAuthInstance;

    try {
      if (!isBrowserEnvironment()) {
        return null;
      }

      if (!this.firebaseAppInstance) {
        this.firebaseAppInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      }
      this.firebaseAuthInstance = getAuth(this.firebaseAppInstance);
      return this.firebaseAuthInstance;
    } catch (err: unknown) {
      console.error("Failed to initialize Firebase Auth:", err);
      return null;
    }
  }

  public getGoogleAuthProvider(): GoogleAuthProvider {
    if (!this.googleAuthProviderInstance) {
      this.googleAuthProviderInstance = new GoogleAuthProvider();
      this.googleAuthProviderInstance.addScope("https://www.googleapis.com/auth/userinfo.email");
      this.googleAuthProviderInstance.addScope("https://www.googleapis.com/auth/userinfo.profile");
      this.googleAuthProviderInstance.setCustomParameters({
        prompt: "select_account",
      });
    }
    return this.googleAuthProviderInstance;
  }

  public async getAccessToken(): Promise<string | null> {
    return this.cachedAccessToken;
  }

  public loadStoredGoogleUser(): GoogleUser | null {
    return this.googleUserSingleton.load();
  }

  public saveStoredGoogleUser(user: GoogleUser | null): void {
    this.googleUserSingleton.save(user);
  }

  public async syncGoogleUserWithBackend(
    user: Partial<GoogleUser>
  ): Promise<GoogleUser> {
    try {
      const data = await apiFetch<{ user: GoogleUser }>("/api/auth/google", {
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
    const auth = this.getFirebaseAuth();
    if (!auth) {
      throw new Error("Google authentication is not available in this environment.");
    }

    this.isSigningIn = true;
    try {
      const provider = this.getGoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      this.cachedAccessToken = credential?.accessToken || null;

      const email = result.user.email;
      if (!email) {
        throw new Error("No verified email address found on the Google account.");
      }

      const name = result.user.displayName || email.split("@")[0];
      const picture = result.user.photoURL || undefined;
      const sub = result.user.uid;

      const syncedUser = await this.syncGoogleUserWithBackend({
        email,
        name,
        picture,
        sub,
        authSource: "google_oauth",
      });

      return { user: syncedUser, accessToken: this.cachedAccessToken || "" };
    } catch (error: unknown) {
      const errObj = error as { code?: string; message?: string };
      if (
        errObj?.code === "auth/popup-closed-by-user" ||
        errObj?.code === "auth/cancelled-popup-request"
      ) {
        throw new Error("Sign-in popup was closed before completing authentication.");
      }
      if (errObj?.code === "auth/popup-blocked") {
        throw new Error("Sign-in popup was blocked by the browser. Please allow popups for this site and try again.");
      }
      console.error("Google sign in error:", error);
      throw error instanceof Error ? error : new Error(String(error));
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
    const auth = this.getFirebaseAuth();
    if (!auth) return () => {};

    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser && firebaseUser.email) {
        const email = firebaseUser.email;
        const name = firebaseUser.displayName || email.split("@")[0];
        const picture = firebaseUser.photoURL || undefined;
        const sub = firebaseUser.uid;

        try {
          const synced = await this.syncGoogleUserWithBackend({
            email,
            name,
            picture,
            sub,
            authSource: "google_oauth",
          });
          if (onAuthSuccess) onAuthSuccess(synced, this.cachedAccessToken);
        } catch {
          const localUser: GoogleUser = {
            email,
            name,
            picture,
            sub,
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
      const data = await apiFetch<{ user: GoogleUser | null }>("/api/auth/user");
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
      const auth = this.getFirebaseAuth();
      if (auth) {
        await firebaseSignOut(auth);
      }
    } catch (err: unknown) {
      console.warn("Firebase signout error:", err);
    }
    this.cachedAccessToken = null;
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network error on logout
    }
    this.saveStoredGoogleUser(null);
  }

  public openGoogleOAuthPopup(authUrl: string): Promise<{ token?: string; code?: string }> {
    return new Promise((resolve, reject) => {
      const width = 540;
      const height = 650;
      const win = getSafeWindow();
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
          clearInterval(pollTimer);
          resolve({
            token: event.data.token,
            code: event.data.code,
          });
        }
      };

      const removeMessage = safeAddEventListener("message", messageHandler);

      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          removeMessage();
          reject(new Error("Authentication popup closed before completing."));
        }
      }, 800);
    });
  }
}

const googleAuthManager = new GoogleAuthManager();

/**
 * Lazily and safely initialize Firebase Auth for browser environments
 */
export function getFirebaseAuth(): Auth | null {
  return googleAuthManager.getFirebaseAuth();
}

/**
 * Returns configured GoogleAuthProvider instance with proper scopes
 */
export function getGoogleAuthProvider(): GoogleAuthProvider {
  return googleAuthManager.getGoogleAuthProvider();
}

/**
 * Returns the currently cached OAuth access token from memory
 */
export const getAccessToken = async (): Promise<string | null> => {
  return googleAuthManager.getAccessToken();
};

/**
 * Loads the active Google user from local client storage
 */
export function loadStoredGoogleUser(): GoogleUser | null {
  return googleAuthManager.loadStoredGoogleUser();
}

/**
 * Alias for loadStoredGoogleUser
 */
export const getStoredGoogleUser = loadStoredGoogleUser;

/**
 * Persists or clears the active Google user in client storage
 */
export function saveStoredGoogleUser(user: GoogleUser | null): void {
  return googleAuthManager.saveStoredGoogleUser(user);
}

/**
 * Calls backend to verify and record Google Account session
 */
export async function syncGoogleUserWithBackend(
  user: Partial<GoogleUser>
): Promise<GoogleUser> {
  return googleAuthManager.syncGoogleUserWithBackend(user);
}

/**
 * Decodes a Google ID token JWT payload safely without requiring heavy external dependencies.
 */
export function parseGoogleJwtPayload(
  token: string
): { email?: string; name?: string; picture?: string; sub?: string } | null {
  return googleAuthManager.parseGoogleJwtPayload(token);
}

/**
 * Initiates the Google OAuth sign-in process via Firebase Auth popup.
 * Opens the Google account sign in consent screen directly without manual email entry.
 */
export async function googleSignIn(): Promise<{ user: GoogleUser; accessToken: string }> {
  return googleAuthManager.googleSignIn();
}

/**
 * Initiates Google login. Initiates Google OAuth popup workflow.
 */
export async function initiateGoogleLogin(
  email?: string,
  name?: string,
  picture?: string,
  sub?: string,
  authSource: "google_oauth" | "google_identity" | "google_account" = "google_oauth"
): Promise<GoogleUser> {
  return googleAuthManager.initiateGoogleLogin(email, name, picture, sub, authSource);
}

/**
 * Initializes Google OAuth state listener.
 */
export const initAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string | null) => void,
  onAuthFailure?: () => void
): (() => void) => {
  return googleAuthManager.initAuth(onAuthSuccess, onAuthFailure);
};

/**
 * Fetches current authenticated Google user session from backend
 */
export async function fetchCurrentGoogleUser(): Promise<GoogleUser | null> {
  return googleAuthManager.fetchCurrentGoogleUser();
}

/**
 * Alias for fetchCurrentGoogleUser
 */
export const fetchServerCurrentUser = fetchCurrentGoogleUser;

/**
 * Terminates the authenticated Google session both on Firebase Auth, backend and client storage.
 */
export async function logoutGoogleUser(): Promise<void> {
  return googleAuthManager.logoutGoogleUser();
}

/**
 * Opens Google OAuth popup and listens for completion via postMessage
 */
export function openGoogleOAuthPopup(authUrl: string): Promise<{ token?: string; code?: string }> {
  return googleAuthManager.openGoogleOAuthPopup(authUrl);
}
