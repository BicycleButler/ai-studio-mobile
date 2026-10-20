import { GoogleUser } from "../types";
import { STORAGE_KEYS, StorageSingleton } from "../utils/storage";
import { apiFetch } from "../utils/apiClient";
import { isBrowserEnvironment, getSafeWindow, safeAddEventListener } from "../utils/platform";
import { IAuthProvider } from "./authProvider";


const googleUserSingleton = new StorageSingleton<GoogleUser | null>(
  STORAGE_KEYS.GOOGLE_USER,
  null
);

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Injectable Auth Provider. Defaulting to Firebase Auth.
let currentAuthProvider: IAuthProvider | null = null;

export function setAuthProvider(provider: IAuthProvider) {
  currentAuthProvider = provider;
}

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export function loadStoredGoogleUser(): GoogleUser | null {
  return googleUserSingleton.load();
}

export function saveStoredGoogleUser(user: GoogleUser | null): void {
  googleUserSingleton.save(user);
  if (isBrowserEnvironment()) {
    getSafeWindow()?.dispatchEvent(
      new CustomEvent("google_user_changed", { detail: user })
    );
  }
}

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

export async function googleSignIn(): Promise<{ user: GoogleUser; accessToken: string }> {
  isSigningIn = true;
  try {
    if (!currentAuthProvider) throw new Error("No AuthProvider configured.");
    const { user, accessToken } = await currentAuthProvider.signIn();
    cachedAccessToken = accessToken;

    const syncedUser = await syncGoogleUserWithBackend({
      ...user,
      authSource: "google_oauth",
    });

    return { user: syncedUser, accessToken: cachedAccessToken || "" };
  } finally {
    isSigningIn = false;
  }
}

export async function initiateGoogleLogin(
  email?: string,
  name?: string,
  picture?: string,
  sub?: string,
  authSource: "google_oauth" | "google_identity" | "google_account" = "google_oauth"
): Promise<GoogleUser> {
  if (email && email.trim()) {
    return syncGoogleUserWithBackend({
      email: email.trim(),
      name: name?.trim() || email.trim().split("@")[0],
      picture,
      sub,
      authSource,
    });
  }

  const { user } = await googleSignIn();
  return user;
}

export const initAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string | null) => void,
  onAuthFailure?: () => void
): (() => void) => {
  if (!currentAuthProvider) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  return currentAuthProvider.onAuthStateChanged(async (user: Partial<GoogleUser> | null, _accessToken: string | null) => {
    if (user && user.email) {
      try {
        const synced = await syncGoogleUserWithBackend({
          ...user,
          authSource: "google_oauth",
        });
        if (onAuthSuccess) onAuthSuccess(synced, cachedAccessToken);
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

export const fetchServerCurrentUser = fetchCurrentGoogleUser;
export const getStoredGoogleUser = loadStoredGoogleUser;

export async function logoutGoogleUser(): Promise<void> {
  try {
    if (currentAuthProvider) await currentAuthProvider.signOut();
  } catch (err: unknown) {
    console.warn("Auth provider signout error:", err);
  }
  cachedAccessToken = null;
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore network error on logout
  }
  saveStoredGoogleUser(null);
}

export function openGoogleOAuthPopup(authUrl: string): Promise<{ token?: string; code?: string }> {
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
