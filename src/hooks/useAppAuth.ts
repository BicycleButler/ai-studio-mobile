import { useState, useEffect } from "react";
import { GoogleUser, ProviderConnection } from "../types";
import { useServices } from "../services/ServiceContext";

export function useAppAuth() {
  const { appAuthManager, providerConnectionService } = useServices();

  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => appAuthManager.getGoogleUser());
  const [hasServerKey, setHasServerKey] = useState<boolean>(() => appAuthManager.hasServerKey());
  const [customApiKey, setCustomApiKey] = useState<string>(() => appAuthManager.getCustomApiKey());
  const [connections, setConnections] = useState<ProviderConnection[]>(() =>
    providerConnectionService.loadConnections()
  );

  const hasApiKey =
    Boolean(googleUser || customApiKey.trim() || hasServerKey) ||
    connections.some((c) => c.enabled && (c.providerId === "local-webllm" || c.providerId === "local-browser" || c.providerId === "local-ollama" || c.providerId === "openai-compatible" || Boolean(c.apiKey?.trim()))) ||
    appAuthManager.hasAnyApiKey();

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
    const unsubProviders = providerConnectionService.connectionsObservable.subscribe((list) => {
      setConnections(list);
    });
    return () => {
      unsubscribe();
      unsubProviders();
    };
  }, [appAuthManager, providerConnectionService]);

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
