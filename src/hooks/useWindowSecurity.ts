import { useState, useEffect, useCallback, useRef } from "react";
import { isFlagSecureEnabled, setFlagSecureEnabled } from "../utils/storage";

interface UseWindowSecurityOptions {
  isSensitiveScreenActive?: boolean;
}

export function useWindowSecurity({
  isSensitiveScreenActive = false,
}: UseWindowSecurityOptions = {}) {
  const [flagSecureEnabled, setFlagSecureEnabledState] = useState<boolean>(() =>
    isFlagSecureEnabled()
  );
  const [isShieldActive, setIsShieldActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleFlagSecure = useCallback((enabled: boolean) => {
    setFlagSecureEnabledState(enabled);
    setFlagSecureEnabled(enabled);
  }, []);

  useEffect(() => {
    const handleFlagChanged = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setFlagSecureEnabledState(customEvent.detail);
      }
    };
    window.addEventListener("flag_secure_changed", handleFlagChanged);
    return () => {
      window.removeEventListener("flag_secure_changed", handleFlagChanged);
    };
  }, []);

  useEffect(() => {
    if (!flagSecureEnabled) {
      setIsShieldActive(false);
      return;
    }

    const clearScheduledTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      clearScheduledTimer();
      if (document.visibilityState === "hidden") {
        // App is entering background, switching apps, or preview snapshot is being taken
        setIsShieldActive(true);
      } else if (document.visibilityState === "visible") {
        // App has returned to foreground; drop shield with a tiny buffer
        timerRef.current = setTimeout(() => {
          setIsShieldActive(false);
        }, 120);
      }
    };

    const handleWindowBlur = () => {
      // If a sensitive modal is active and window loses focus (e.g. app switcher gesture initiated)
      if (isSensitiveScreenActive) {
        setIsShieldActive(true);
      }
    };

    const handleWindowFocus = () => {
      clearScheduledTimer();
      timerRef.current = setTimeout(() => {
        setIsShieldActive(false);
      }, 120);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      clearScheduledTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [flagSecureEnabled, isSensitiveScreenActive]);

  return {
    isShieldActive,
    flagSecureEnabled,
    toggleFlagSecure,
  };
}
