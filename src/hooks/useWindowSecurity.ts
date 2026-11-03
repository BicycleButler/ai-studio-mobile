import { useEffect, useCallback, useRef } from "react";
import { useServices } from "../services/ServiceContext";
import { useStore } from "./useStore";

interface UseWindowSecurityOptions {
  isSensitiveScreenActive?: boolean;
}

export function useWindowSecurity({
  isSensitiveScreenActive = false,
}: UseWindowSecurityOptions = {}) {
  const { generalSettingsService, windowSecurityService, idGenerator } = useServices();

  const flagSecureEnabled = useStore(generalSettingsService.flagSecureObservable)!;

  // We need a stable ID for the lifetime of this hook mount
  const hookId = useRef(idGenerator.generate("hook")).current;

  useEffect(() => {
     windowSecurityService.registerScreen(hookId, isSensitiveScreenActive);
     return () => {
         windowSecurityService.unregisterScreen(hookId);
     }
  }, [isSensitiveScreenActive, hookId, windowSecurityService]);

  const shieldState = useStore(windowSecurityService.shieldStore);

  const toggleFlagSecure = useCallback((enabled: boolean) => {
    // Synchronously update for immediate getSnapshot return and state updates
    generalSettingsService.setFlagSecureEnabled(enabled);
  }, [generalSettingsService]);

  return {
    isShieldActive: shieldState?.isShieldActive || false,
    flagSecureEnabled,
    toggleFlagSecure,
  };
}
