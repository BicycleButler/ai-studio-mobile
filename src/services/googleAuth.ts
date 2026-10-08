import { isBrowserEnvironment } from "../utils/platform";
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  type Auth,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { GoogleUser } from "../types";
import { safeGetStorage, safeSetStorage } from "../utils/storage";
import { apiFetch } from "../utils/apiClient";

const GOOGLE_USER_STORAGE_KEY = "ai_studio_google_user_v1";

// In-memory token cache as required by OAuth security guidelines
let cachedAccessToken: string | null = null;
let isSigningIn = false;

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;
let googleAuthProviderInstance: GoogleAuthProvider | null = null;

/**
 * Lazily and safely initialize Firebase Auth for browser environments
 */
export function getFirebaseAuth(): Auth | null {
  if (firebaseAuthInstance) return firebaseAuthInstance;

  try {
    if (!isBrowserEnvironment()) {
      return null;
    }

    if (!firebaseAppInstance) {
      firebaseAppInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    }
    firebaseAuthInstance = getAuth(firebaseAppInstance);
    return firebaseAuthInstance;
  } catch (err: unknown) {
    console.error("Failed to initialize Firebase Auth:", err);
    return null;
  }
}

/**
 * Returns configured GoogleAuthProvider instance with proper scopes
 */
export function getGoogleAuthProvider(): GoogleAuthProvider {
  if (!googleAuthProviderInstance) {
    googleAuthProviderInstance = new GoogleAuthProvider();
    googleAuthProviderInstance.addScope("https://www.googleapis.com/auth/userinfo.email");
    googleAuthProviderInstance.addScope("https://www.googleapis.com/auth/userinfo.profile");
    googleAuthProviderInstance.setCustomParameters({
      prompt: "select_account",
    });
  }
  return googleAuthProviderInstance;
}

/**
 * Returns the currently cached OAuth access token from memory
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Loads the active Google user from local client storage
 */
export function loadStoredGoogleUser(): GoogleUser | null {
  return safeGetStorage<GoogleUser | null>(GOOGLE_USER_STORAGE_KEY, null);
}

/**
 * Alias for loadStoredGoogleUser
 */
export const getStoredGoogleUser = loadStoredGoogleUser;

/**
 * Persists or clears the active Google user in client storage
 */
export function saveStoredGoogleUser(user: GoogleUser | null): void {
  safeSetStorage(GOOGLE_USER_STORAGE_KEY, user);
}

/**
 * Calls backend to verify and record Google Account session
 */
export async function syncGoogleUserWithBackend(
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

    saveStoredGoogleUser(data.user);
    return data.user;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Failed to authenticate Google account with server.");
  }
}

/**
 * Decodes a Google ID token JWT payload safely without requiring heavy external dependencies.
 */
export function parseGoogleJwtPayload(
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

/**
 * Initiates the Google OAuth sign-in process via Firebase Auth popup.
 * Opens the Google account sign in consent screen directly without manual email entry.
 */
export async function googleSignIn(): Promise<{ user: GoogleUser; accessToken: string }> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Google authentication is not available in this environment.");
  }

  isSigningIn = true;
  try {
    const provider = getGoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    cachedAccessToken = credential?.accessToken || null;

    const email = result.user.email;
    if (!email) {
      throw new Error("No verified email address found on the Google account.");
    }

    const name = result.user.displayName || email.split("@")[0];
    const picture = result.user.photoURL || undefined;
    const sub = result.user.uid;

    const syncedUser = await syncGoogleUserWithBackend({
      email,
      name,
      picture,
      sub,
      authSource: "google_oauth",
    });

    return { user: syncedUser, accessToken: cachedAccessToken || "" };
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
    isSigningIn = false;
  }
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
  // If email is provided programmatically, sync with backend
  if (email && email.trim()) {
    return syncGoogleUserWithBackend({
      email: email.trim(),
      name: name?.trim() || email.trim().split("@")[0],
      picture,
      sub,
      authSource,
    });
  }

  // Otherwise, trigger the real Google OAuth sign in process
  const { user } = await googleSignIn();
  return user;
}

/**
 * Initializes Google OAuth state listener.
 */
export const initAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string | null) => void,
  onAuthFailure?: () => void
): (() => void) => {
  const auth = getFirebaseAuth();
  if (!auth) return () => {};

  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser && firebaseUser.email) {
      const email = firebaseUser.email;
      const name = firebaseUser.displayName || email.split("@")[0];
      const picture = firebaseUser.photoURL || undefined;
      const sub = firebaseUser.uid;

      try {
        const synced = await syncGoogleUserWithBackend({
          email,
          name,
          picture,
          sub,
          authSource: "google_oauth",
        });
        if (onAuthSuccess) onAuthSuccess(synced, cachedAccessToken);
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
        saveStoredGoogleUser(localUser);
        if (onAuthSuccess) onAuthSuccess(localUser, cachedAccessToken);
      }
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Fetches current authenticated Google user session from backend
 */
export async function fetchCurrentGoogleUser(): Promise<GoogleUser | null> {
  try {
    const data = await apiFetch<{ user: GoogleUser | null }>("/api/auth/user");
    if (data.user) {
      saveStoredGoogleUser(data.user);
      return data.user;
    }
    return null;
  } catch {
    return loadStoredGoogleUser();
  }
}

/**
 * Alias for fetchCurrentGoogleUser
 */
export const fetchServerCurrentUser = fetchCurrentGoogleUser;

/**
 * Terminates the authenticated Google session both on Firebase Auth, backend and client storage.
 */
export async function logoutGoogleUser(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (auth) {
      await firebaseSignOut(auth);
    }
  } catch (err: unknown) {
    console.warn("Firebase signout error:", err);
  }
  cachedAccessToken = null;
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore network error on logout
  }
  saveStoredGoogleUser(null);
}

/**
 * Opens Google OAuth popup and listens for completion via postMessage
 */
export function openGoogleOAuthPopup(authUrl: string): Promise<{ token?: string; code?: string }> {
  return new Promise((resolve, reject) => {
    const width = 540;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
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
        window.removeEventListener("message", messageHandler);
        clearInterval(pollTimer);
        resolve({
          token: event.data.token,
          code: event.data.code,
        });
      }
    };

    window.addEventListener("message", messageHandler);

    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", messageHandler);
        reject(new Error("Authentication popup closed before completing."));
      }
    }, 800);
  });
}
