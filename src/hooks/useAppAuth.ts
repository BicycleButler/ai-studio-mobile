import { useState, useEffect } from "react";
import { GoogleUser } from "../types";
import { useServices } from "../services/ServiceContext";

export function useAppAuth() {
  const { generalSettingsService } = useServices();
  const { googleAuthService, logger } = useServices();

  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => googleAuthService.loadStoredGoogleUser());
  const [hasServerKey, setHasServerKey] = useState<boolean>(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => generalSettingsService.loadStoredApiKey());
  const hasApiKey = Boolean(googleUser || customApiKey.trim() || hasServerKey);

  const handleSaveApiKey = (key: string) => {
    generalSettingsService.saveStoredApiKey(key);
    setCustomApiKey(key);
  };

  const handleGoogleLogin = async () => {
    try {
      const u = await googleAuthService.initiateGoogleLogin();
      setGoogleUser(u);
    } catch (err) {
      logger.error("Google login failed", err);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleAuthService.logoutGoogleUser();
      setGoogleUser(null);
    } catch (err) {
      logger.error("Logout failed", err);
    }
  };

  const refreshServerAuth = async () => {
    const freshUser = await googleAuthService.fetchCurrentGoogleUser();
    setGoogleUser(freshUser);
  };

  useEffect(() => {
    Promise.resolve(googleAuthService.initAuth())
      .then((res: unknown) => {
        const r = res as { hasServerKey?: boolean };
        if (r && r.hasServerKey) {
          setHasServerKey(r.hasServerKey);
        }
        refreshServerAuth();
      })
      .catch((err) => logger.error("Auth init failed", err));
  }, [googleAuthService, logger]);

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
