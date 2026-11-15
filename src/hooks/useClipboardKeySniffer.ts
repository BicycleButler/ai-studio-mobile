import { useState, useEffect, useCallback, useRef } from "react";
import { useServices } from "../services/ServiceContext";


interface UseClipboardKeySnifferOptions {
  activeApiKey?: string;
  onKeyDetected?: (key: string) => void;
  enabled?: boolean;
  detectKeyFn?: (text: string) => string | null;
}

export function useClipboardKeySniffer({
  activeApiKey = "",
  onKeyDetected,
  enabled = true,
  detectKeyFn,
}: UseClipboardKeySnifferOptions = {}) {
  const { keyVerificationService, clipboardService, platformService } = useServices();
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const dismissedKeyRef = useRef<string | null>(null);
  const lastCheckedTextRef = useRef<string>("");

  const inspectClipboard = useCallback(async (): Promise<string | null> => {
    if (!enabled) return null;

    setIsChecking(true);
    try {
      const text = await clipboardService.readText() || "";
      if (!text || text === lastCheckedTextRef.current) {
        setIsChecking(false);
        return null;
      }

      lastCheckedTextRef.current = text;
      const resolveDetectKey = detectKeyFn ?? ((t: string) => keyVerificationService.detectGoogleApiKey(t));
      const key = resolveDetectKey(text);

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

  // Dismiss detected key so it will not prompt again in the same session
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
      const doc = platformService.getDocument();
      if (doc?.visibilityState === "visible") {
        // Slight delay to allow Android OS clipboard bridge to sync upon app resume
        platformService.setTimeout(() => {
          void inspectClipboard();
        }, 250);
      }
    };

    const handleFocus = () => {
      platformService.setTimeout(() => {
        void inspectClipboard();
      }, 250);
    };

    const removeVis = platformService.addDocumentListener("visibilitychange", handleVisibilityChange);
    const removeFocus = platformService.addEventListener("focus", handleFocus);

    return () => {
      removeVis();
      removeFocus();
    };
  }, [enabled, inspectClipboard, platformService]);

  return {
    detectedKey,
    isChecking,
    inspectClipboard,
    dismissDetectedKey,
    clearDetectedKey: () => setDetectedKey(null),
  };
}
