import { useState, useEffect } from "react";
import { GoogleUser } from "../types";
import {
  getStoredGoogleUser,
  fetchServerCurrentUser,
  initiateGoogleLogin,
  logoutGoogleUser,
  initAuth,
} from "../services/googleAuth";
import { loadStoredApiKey, saveStoredApiKey } from "../utils/storage";

export function useAppAuth() {
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => getStoredGoogleUser());
  const [hasServerKey, setHasServerKey] = useState<boolean>(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => loadStoredApiKey());
  const hasApiKey = Boolean(googleUser || customApiKey.trim() || hasServerKey);

  const handleSaveApiKey = (key: string) => {
    saveStoredApiKey(key);
    setCustomApiKey(key);
  };

  const handleGoogleLogin = async () => {
    try {
      const u = await initiateGoogleLogin();
      setGoogleUser(u);
    } catch (err) {
      console.error("Google login failed", err);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutGoogleUser();
      setGoogleUser(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const refreshServerAuth = async () => {
    const freshUser = await fetchServerCurrentUser();
    setGoogleUser(freshUser);
  };

  useEffect(() => {
    Promise.resolve(initAuth())
      .then((res: unknown) => {
        const r = res as { hasServerKey?: boolean };
        if (r && r.hasServerKey) {
          setHasServerKey(r.hasServerKey);
        }
        refreshServerAuth();
      })
      .catch(console.error);
  }, []);

  return {
    googleUser,
    setGoogleUser,
    hasServerKey,
    setHasServerKey,
    customApiKey,
    setCustomApiKey,
    hasApiKey,
    handleSaveApiKey,
    handleGoogleLogin,
    handleGoogleLogout,
    refreshServerAuth,
  };
}
