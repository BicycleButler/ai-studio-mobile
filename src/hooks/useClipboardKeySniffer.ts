import { useState, useEffect, useCallback, useRef } from "react";
import { detectGoogleApiKey } from "../services/keyVerification";
import { isBrowserEnvironment, safeAddEventListener, safeAddDocumentListener } from "../utils/platform";

interface UseClipboardKeySnifferOptions {
  activeApiKey?: string;
  onKeyDetected?: (key: string) => void;
  enabled?: boolean;
}

export function useClipboardKeySniffer({
  activeApiKey = "",
  onKeyDetected,
  enabled = true,
}: UseClipboardKeySnifferOptions = {}) {
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const dismissedKeyRef = useRef<string | null>(null);
  const lastCheckedTextRef = useRef<string>("");

  const inspectClipboard = useCallback(async (): Promise<string | null> => {
    if (!enabled) return null;
    if (!isBrowserEnvironment() || !navigator.clipboard || !navigator.clipboard.readText) {
      return null;
    }

    setIsChecking(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text === lastCheckedTextRef.current) {
        setIsChecking(false);
        return null;
      }

      lastCheckedTextRef.current = text;
      const key = detectGoogleApiKey(text);

      if (key) {
        const trimmedActive = activeApiKey.trim();
        // Ignore if identical to the currently active project key
        if (key === trimmedActive) {
          setIsChecking(false);
          return null;
        }

        // Ignore if user previously dismissed this exact key
        if (key === dismissedKeyRef.current) {
          setIsChecking(false);
          return null;
        }

        setDetectedKey(key);
        onKeyDetected?.(key);
        setIsChecking(false);
        return key;
      }
    } catch {
      // Clipboard access might be blocked without active user gesture in some browsers
    } finally {
      setIsChecking(false);
    }
    return null;
  }, [activeApiKey, enabled, onKeyDetected]);

  // Dismiss detected key so it won't prompt again in the same session
  const dismissDetectedKey = useCallback(() => {
    if (detectedKey) {
      dismissedKeyRef.current = detectedKey;
    }
    setDetectedKey(null);
  }, [detectedKey]);

  // Hook into background-to-foreground resume
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Slight delay to allow Android OS clipboard bridge to sync upon app resume
        setTimeout(() => {
          void inspectClipboard();
        }, 250);
      }
    };

    const handleFocus = () => {
      setTimeout(() => {
        void inspectClipboard();
      }, 250);
    };

    const removeVis = safeAddDocumentListener("visibilitychange", handleVisibilityChange);
    const removeFocus = safeAddEventListener("focus", handleFocus);

    return () => {
      removeVis();
      removeFocus();
    };
  }, [enabled, inspectClipboard]);

  return {
    detectedKey,
    isChecking,
    inspectClipboard,
    dismissDetectedKey,
    clearDetectedKey: () => setDetectedKey(null),
  };
}
