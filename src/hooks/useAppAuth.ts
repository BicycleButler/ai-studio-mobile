import { useState, useEffect } from "react";
import { GoogleUser } from "../types";
import { useServices } from "../services/ServiceContext";

export function useAppAuth() {
  const { appAuthManager } = useServices();

  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => appAuthManager.getGoogleUser());
  const [hasServerKey, setHasServerKey] = useState<boolean>(() => appAuthManager.hasServerKey());
  const [customApiKey, setCustomApiKey] = useState<string>(() => appAuthManager.getCustomApiKey());

  const hasApiKey = appAuthManager.hasAnyApiKey();

  const handleSaveApiKey = (key: string) => {
    appAuthManager.saveCustomApiKey(key);
    setCustomApiKey(key);
  };

  const handleGoogleLogin = async () => {
    try {
      const u = await appAuthManager.initiateGoogleLogin();
      setGoogleUser(u);
    } catch {
      // error handling is managed by the manager
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await appAuthManager.logoutGoogleUser();
      setGoogleUser(null);
    } catch {
      // error handling is managed by the manager
    }
  };

  const refreshServerAuth = async () => {
    await appAuthManager.refreshServerAuth();
    setHasServerKey(appAuthManager.hasServerKey());
  };

  useEffect(() => {
    const unsubscribe = appAuthManager.initializeAuth(
      (serverKeyStatus) => {
        setHasServerKey(serverKeyStatus);
      },
      (user) => {
        setGoogleUser(user);
      }
    );
    return () => unsubscribe();
  }, [appAuthManager]);

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
