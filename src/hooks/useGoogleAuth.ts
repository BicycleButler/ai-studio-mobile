import { useState, useCallback, useEffect } from "react";
import { GoogleUser } from "../types";
import { useServices } from "../services/ServiceContext";

export function useGoogleAuth() {
  const { appAuthManager, logger } = useServices();
  const [user, setUser] = useState<GoogleUser | null>(appAuthManager.getGoogleUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch to sync state
    setUser(appAuthManager.getGoogleUser());

    // Set up auth state listener
    const unsubscribe = appAuthManager.initializeAuth(() => {}, (syncedUser) => {
      setUser(syncedUser);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [appAuthManager]);

  const handleLogin = useCallback(async (email?: string, name?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const loggedInUser = await appAuthManager.initiateGoogleLogin(email, name);
      setUser(loggedInUser);
    } catch (err: unknown) {
      logger.error("Sign in error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to authenticate Google account. Please try again."
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [appAuthManager, logger]);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await appAuthManager.logoutGoogleUser();
      setUser(null);
    } catch (err: unknown) {
      logger.error("Sign out error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign out.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [appAuthManager, logger]);

  return {
    user,
    isLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
  };
}
