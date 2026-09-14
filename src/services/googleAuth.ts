import { GoogleUser } from "../types";
import { safeGetStorage, safeSetStorage } from "../utils/storage";

const GOOGLE_USER_STORAGE_KEY = "ai_studio_google_user_v1";

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
  const res = await fetch("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Failed to authenticate Google account with server.");
  }

  const data = (await res.json()) as { user: GoogleUser };
  saveStoredGoogleUser(data.user);
  return data.user;
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
 * Initiates Google login by syncing with the backend and saving the active user.
 */
export async function initiateGoogleLogin(
  email?: string,
  name?: string,
  picture?: string,
  sub?: string,
  authSource: "google_oauth" | "google_identity" | "google_account" = "google_account"
): Promise<GoogleUser> {
  const targetEmail = email?.trim();
  if (!targetEmail) {
    throw new Error("A valid email address is required to connect your Google account.");
  }
  const targetName = name?.trim() || targetEmail.split("@")[0];
  return syncGoogleUserWithBackend({
    email: targetEmail,
    name: targetName,
    picture,
    sub,
    authSource,
  });
}

/**
 * Fetches current authenticated Google user session from backend
 */
export async function fetchCurrentGoogleUser(): Promise<GoogleUser | null> {
  try {
    const res = await fetch("/api/auth/user");
    if (!res.ok) return null;
    const data = (await res.json()) as { user: GoogleUser | null };
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
 * Terminates the authenticated Google session both on backend and client
 */
export async function logoutGoogleUser(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore network error on logout
  }
  saveStoredGoogleUser(null);
}

/**
 * Opens Google OAuth popup and listens for completion via postMessage
 * conforming to the AI Studio OAuth integration pattern.
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
      // Validate origin if desired, or check event.data type
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

    // Poll for closed popup
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", messageHandler);
        reject(new Error("Authentication popup closed before completing."));
      }
    }, 800);
  });
}
