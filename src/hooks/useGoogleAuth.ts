import { useState, useCallback, useEffect } from "react";
import { GoogleUser } from "../types";
import { useServices } from "../services/ServiceContext";

export function useGoogleAuth() {
  const { googleAuthService, logger } = useServices();
  const [user, setUser] = useState<GoogleUser | null>(googleAuthService.loadStoredGoogleUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch to sync state
    setUser(googleAuthService.loadStoredGoogleUser());

    // Set up auth state listener
    const unsubscribe = googleAuthService.initAuth((syncedUser) => {
      setUser(syncedUser);
    }, () => {
      setUser(null);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [googleAuthService]);

  const handleLogin = useCallback(async (email?: string, name?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const loggedInUser = await googleAuthService.initiateGoogleLogin(email, name);
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
  }, [googleAuthService, logger]);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await googleAuthService.logoutGoogleUser();
      setUser(null);
    } catch (err: unknown) {
      logger.error("Sign out error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign out.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [googleAuthService, logger]);

  return {
    user,
    isLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
  };
}
