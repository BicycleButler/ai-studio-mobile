import { useEffect, useRef } from "react";

import { useServices } from "../services/ServiceContext";

/**
 * useBackNavigation Hook
 *
 * Enables device back navigation (Android back gesture/button, browser back button,
 * and keyboard navigation) to smoothly dismiss slide-out drawers and modals.
 * When the drawer opens, a history entry is pushed so that pressing "Back"
 * closes the drawer instead of exiting the application or losing workspace context.
 *
 * When the drawer is closed via UI (such as an "X" button at the top right,
 * an on-screen "Back" button, or Escape key), the history entry is cleanly reverted.
 */
export function useBackNavigation(
  isOpen: boolean,
  onClose: () => void,
  drawerId: string
) {
  const { platformService } = useServices();
  const isPoppedBySystemRef = useRef(false);
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);

  // Keep onClose updated without triggering the effect on every render
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      pushedRef.current = false;
      return;
    }

    isPoppedBySystemRef.current = false;
    pushedRef.current = true;

    const stateKey = `drawer_${drawerId}`;
    const state = { [stateKey]: true, drawerId, timestamp: Date.now() };

    try {
      const win = platformService.getWindow() as Window & { history?: History };
      win?.history?.pushState(state, "");
    } catch {
      // Ignore security errors in sandboxed environments
    }

    const handlePopState = () => {
      // Marked as popped by browser/system back navigation
      isPoppedBySystemRef.current = true;
      onCloseRef.current();
    };

    const removePopState = platformService.addEventListener("popstate", handlePopState);

    return () => {
      removePopState();

      // If closed by UI action (X button, UI Back button, Esc) rather than popstate
      if (pushedRef.current && !isPoppedBySystemRef.current) {
        try {
          const win = platformService.getWindow() as Window & { history?: History };
          if (win?.history?.state && win.history.state[stateKey]) {
            win.history.back();
          }
        } catch {
          // Ignore
        }
      }
      pushedRef.current = false;
    };
  }, [isOpen, drawerId, platformService]);
}
